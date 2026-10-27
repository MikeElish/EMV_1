"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { accessDenied, hasAccess } from "@/lib/access-server";
import { OneCError } from "@/lib/onec";
import { loadOneCGoods } from "@/lib/onec-sync";
import { getWarehouseData } from "@/lib/onec-warehouse";
import {
  WAREHOUSE_TYPES,
  createInventory,
  createReceipt,
  createTransfer,
  createWriteOff,
  saveWarehouseCard,
  type CreatedDoc,
  type DocLine,
  type InventoryLine,
} from "@/lib/onec-stock-docs";

export type WarehouseActionResult = { ok: true } | { ok: false; error: string };
export type DocsResult = { ok: true; docs: CreatedDoc[] } | { ok: false; error: string };

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n < 1e7;

function fail(error: unknown): { ok: false; error: string } {
  if (error instanceof OneCError) return { ok: false, error: error.message };
  console.error("[warehouse] 1С write failed:", error);
  return { ok: false, error: "Не удалось записать документ в 1С" };
}

function cleanLines(lines: DocLine[]): DocLine[] | null {
  if (!Array.isArray(lines) || lines.length > 500) return null;
  for (const l of lines) {
    if (!GUID.test(l.itemRef) || !isNum(l.qty) || (l.price !== undefined && !isNum(l.price))) return null;
  }
  return lines;
}

function done(docs: CreatedDoc[]): DocsResult {
  revalidatePath("/admin/warehouse", "layout");
  revalidatePath("/admin/reports/movements");
  return { ok: true, docs };
}

/** Создать перемещение: from one 1С warehouse to another, posted in 1С. */
export async function createTransferDoc(from: string, to: string, lines: DocLine[], comment: string): Promise<DocsResult> {
  const denied = await accessDenied("warehouse");
  if (denied) return denied;
  const rows = cleanLines(lines);
  if (!rows || !GUID.test(from) || !GUID.test(to)) return { ok: false, error: "Некорректные данные документа" };
  try {
    return done([await createTransfer(from, to, rows, comment.trim().slice(0, 500))]);
  } catch (error) {
    return fail(error);
  }
}

/** Списание / Оприходование from the «+» of their tab. */
export async function createAdjustmentDoc(
  kind: "writeoff" | "receipt",
  warehouse: string,
  lines: DocLine[],
  comment: string
): Promise<DocsResult> {
  const denied = await accessDenied("warehouse");
  if (denied) return denied;
  const rows = cleanLines(lines);
  if (!rows || !GUID.test(warehouse)) return { ok: false, error: "Некорректные данные документа" };
  try {
    const note = comment.trim().slice(0, 500);
    return done([kind === "writeoff" ? await createWriteOff(warehouse, rows, note) : await createReceipt(warehouse, rows, note)]);
  } catch (error) {
    return fail(error);
  }
}

/** Инвентаризация: the counted quantities; shortages and surpluses become documents in 1С. */
export async function createInventoryDoc(warehouse: string, lines: InventoryLine[], comment: string): Promise<DocsResult> {
  const denied = await accessDenied("warehouse");
  if (denied) return denied;
  if (
    !GUID.test(warehouse) ||
    !Array.isArray(lines) ||
    lines.length > 5000 ||
    lines.some((l) => !GUID.test(l.itemRef) || !isNum(l.fact) || !isNum(l.price) || typeof l.book !== "number")
  ) {
    return { ok: false, error: "Некорректные данные инвентаризации" };
  }
  try {
    return done(await createInventory(warehouse, lines, comment.trim().slice(0, 500)));
  } catch (error) {
    return fail(error);
  }
}

export type ItemHit = { ref: string; name: string; sku: string; price: number | null };

/** Goods of 1С for a document line: by article or name, with the site's purchase price (rubles). */
export async function searchOneCItems(query: string): Promise<ItemHit[]> {
  if (!(await hasAccess("warehouse", "edit"))) return [];
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const goods = await loadOneCGoodsCached();
  const hits = goods.filter((g) => words.every((w) => `${g.sku} ${g.name}`.toLowerCase().includes(w))).slice(0, 30);
  return withPrices(hits.map((g) => ({ ref: g.ref, name: g.name, sku: g.sku })));
}

/** The site's purchase price of the products behind 1С cards, rubles. */
export async function itemPrices(refs: string[]): Promise<Record<string, number>> {
  if (!(await hasAccess("warehouse", "view")) || !Array.isArray(refs)) return {};
  const priced = await withPrices(refs.filter((r) => GUID.test(r)).slice(0, 5000).map((ref) => ({ ref, name: "", sku: "" })));
  return Object.fromEntries(priced.filter((p) => p.price).map((p) => [p.ref, p.price!]));
}

async function withPrices(items: { ref: string; name: string; sku: string }[]): Promise<ItemHit[]> {
  const links = await prisma.oneCProductLink.findMany({
    where: { ref: { in: items.map((i) => i.ref) } },
    select: { ref: true, product: { select: { pricing: { select: { purchasePrice: true } } } } },
  });
  const price = new Map(links.map((l) => [l.ref, l.product.pricing?.purchasePrice ?? 0]));
  return items.map((i) => ({ ...i, price: price.get(i.ref) ? price.get(i.ref)! / 100 : null }));
}

const goodsCache = globalThis as unknown as { __emvGoodsForDocs?: { at: number; data: ReturnType<typeof loadOneCGoods> } };
function loadOneCGoodsCached() {
  const hit = goodsCache.__emvGoodsForDocs;
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.data;
  const data = loadOneCGoods();
  goodsCache.__emvGoodsForDocs = { at: Date.now(), data };
  data.catch(() => (goodsCache.__emvGoodsForDocs = undefined));
  return data;
}

/** Настройки → Склады: a new warehouse in 1С, or its name / type / comment changed. */
export async function saveWarehouse(
  ref: string | null,
  data: { name: string; type: string; comment: string }
): Promise<WarehouseActionResult> {
  const denied = await accessDenied("settings.warehouses");
  if (denied) return denied;
  const name = data.name.trim().slice(0, 100);
  if (!name) return { ok: false, error: "Укажите название склада" };
  if (!(data.type in WAREHOUSE_TYPES)) return { ok: false, error: "Некорректный тип склада" };
  if (ref !== null && !GUID.test(ref)) return { ok: false, error: "Склад не найден" };
  try {
    await saveWarehouseCard(ref, { name, type: data.type, comment: data.comment.trim().slice(0, 500) });
  } catch (error) {
    return fail(error);
  }
  revalidatePath("/admin/settings/warehouses");
  revalidatePath("/admin/warehouse", "layout");
  return { ok: true };
}

/** Место хранения of an item on a warehouse; empty clears it. */
export async function setStoragePlace(warehouseRef: string, itemRef: string, place: string): Promise<WarehouseActionResult> {
  const denied = await accessDenied("warehouse");
  if (denied) return denied;
  const value = place.trim().slice(0, 100);
  if (!/^[0-9a-f-]{36}$/i.test(warehouseRef) || !/^[0-9a-f-]{36}$/i.test(itemRef)) {
    return { ok: false, error: "Некорректный склад или товар" };
  }
  if (value) {
    await prisma.storagePlace.upsert({
      where: { warehouseRef_itemRef: { warehouseRef, itemRef } },
      create: { warehouseRef, itemRef, place: value },
      update: { place: value },
    });
  } else {
    await prisma.storagePlace.deleteMany({ where: { warehouseRef, itemRef } });
  }
  revalidatePath("/admin/warehouse", "layout");
  return { ok: true };
}

/** «Обновить»: reads 1С again instead of the 5-minute copy. */
export async function refreshWarehouseData(): Promise<WarehouseActionResult> {
  if (!(await hasAccess(["warehouse", "reports.movements"], "view"))) return { ok: false, error: "Нет доступа" };
  try {
    await getWarehouseData(true);
  } catch (error) {
    return { ok: false, error: error instanceof OneCError ? error.message : "1С не ответила" };
  }
  revalidatePath("/admin/warehouse", "layout");
  revalidatePath("/admin/reports/movements");
  return { ok: true };
}
