import "server-only";
import { OneCError, oneCGet, oneCGetAll, oneCSend } from "@/lib/onec";
import { GOODS_ACCOUNTS, oneCDateTime, syncStockFromOneC } from "@/lib/onec-stock";
import { getWarehouseData } from "@/lib/onec-warehouse";

// Склад writes its documents straight into 1С:Бухгалтерия and posts them:
// Перемещение, Списание, Оприходование, Инвентаризация (its shortages and
// surpluses become a Списание and an Оприходование based on it). Filled like
// the ones the accountant makes by hand; a document 1С refuses to post is
// marked for deletion and 1С's reason is shown.

export type DocLine = { itemRef: string; qty: number; /** rubles */ price?: number };
export type CreatedDoc = { kind: string; number: string };

const q = encodeURIComponent;
const EMPTY = "00000000-0000-0000-0000-000000000000";
const round2 = (n: number) => Math.round(n * 100) / 100;

async function context() {
  const [orgs, chart] = await Promise.all([
    oneCGetAll<{ Ref_Key: string; DeletionMark: boolean }>("Catalog_Организации", ["Ref_Key", "DeletionMark"]),
    oneCGet<{ value?: { Ref_Key: string; Code: string }[] }>(`/${q("ChartOfAccounts_Хозрасчетный")}?$select=Ref_Key,Code`),
  ]);
  const org = orgs.find((o) => !o.DeletionMark)?.Ref_Key;
  const account = (chart.value ?? []).find((a) => a.Code.trim() === GOODS_ACCOUNTS[0])?.Ref_Key;
  if (!org || !account) throw new OneCError("В 1С не найдена организация или счёт 41.01");
  return { org, account };
}

/** Unit of measure of each 1С item (lines need it). */
async function units(itemRefs: string[]): Promise<Map<string, string>> {
  const entries = await Promise.all(
    [...new Set(itemRefs)].map(async (ref) => {
      const card = await oneCGet<{ ЕдиницаИзмерения_Key?: string }>(
        `/${q("Catalog_Номенклатура")}(guid'${ref}')?$select=ЕдиницаИзмерения_Key`
      );
      return [ref, card.ЕдиницаИзмерения_Key ?? EMPTY] as const;
    })
  );
  return new Map(entries);
}

/** Creates the document, posts it; if 1С won't post it, marks it for deletion and says why. */
async function createPosted(entity: string, data: Record<string, unknown>): Promise<{ ref: string; number: string }> {
  const created = await oneCSend<{ Ref_Key: string; Number: string }>("POST", `/${q(entity)}`, data);
  try {
    await oneCSend("POST", `/${q(entity)}(guid'${created.Ref_Key}')/Post?PostingModeOperational=false`);
  } catch (error) {
    await oneCSend("PATCH", `/${q(entity)}(guid'${created.Ref_Key}')`, { DeletionMark: true }).catch(() => {});
    throw new OneCError(
      `1С не провела документ № ${created.Number.trim()} (он помечен на удаление): ${error instanceof Error ? error.message : ""}`
    );
  }
  return { ref: created.Ref_Key, number: created.Number.trim() };
}

/** After a document: Склад and «Наличие» on the site follow at once. */
async function afterWrite() {
  await getWarehouseData(true).catch(() => {});
  await syncStockFromOneC().catch((error) => console.error("[1c-stock] after document", error));
}

function checkLines(lines: DocLine[]) {
  const clean = lines.filter((l) => l.itemRef && l.qty > 0);
  if (!clean.length) throw new OneCError("Добавьте хотя бы один товар с количеством");
  return clean;
}

export async function createTransfer(from: string, to: string, lines: DocLine[], comment: string): Promise<CreatedDoc> {
  if (from === to) throw new OneCError("Склады отправителя и получателя совпадают");
  const rows = checkLines(lines);
  const [{ org, account }, unit] = await Promise.all([context(), units(rows.map((l) => l.itemRef))]);
  const { number } = await createPosted("Document_ПеремещениеТоваров", {
    Date: oneCDateTime(new Date()),
    Организация_Key: org,
    ВидОперации: "ПередачаМеждуСкладами",
    СкладОтправитель_Key: from,
    СкладПолучатель_Key: to,
    Комментарий: comment,
    Товары: rows.map((l, i) => ({
      LineNumber: String(i + 1),
      Номенклатура_Key: l.itemRef,
      ЕдиницаИзмерения_Key: unit.get(l.itemRef),
      Коэффициент: 1,
      Количество: l.qty,
      СчетУчета_Key: account,
      НовыйСчетУчета_Key: account,
    })),
  });
  await afterWrite();
  return { kind: "Перемещение", number };
}

export async function createWriteOff(
  warehouse: string,
  lines: DocLine[],
  comment: string,
  inventory?: { ref: string; number: string }
): Promise<CreatedDoc> {
  const rows = checkLines(lines);
  const [{ org, account }, unit] = await Promise.all([context(), units(rows.map((l) => l.itemRef))]);
  const { number } = await createPosted("Document_СписаниеТоваров", {
    Date: oneCDateTime(new Date()),
    Организация_Key: org,
    Склад_Key: warehouse,
    ВидОперации: "СписаниеСоСклада",
    Комментарий: comment,
    ...(inventory ? { ИнвентаризацияТоваровНаСкладе_Key: inventory.ref, Основание: `Инвентаризация № ${inventory.number}` } : {}),
    Товары: rows.map((l, i) => ({
      LineNumber: String(i + 1),
      Номенклатура_Key: l.itemRef,
      ЕдиницаИзмерения_Key: unit.get(l.itemRef),
      Коэффициент: 1,
      Количество: l.qty,
      СчетУчета_Key: account,
      ОтражениеВУСН: "НеПринимаются",
    })),
  });
  if (!inventory) await afterWrite();
  return { kind: "Списание", number };
}

export async function createReceipt(
  warehouse: string,
  lines: DocLine[],
  comment: string,
  inventory?: { ref: string; number: string }
): Promise<CreatedDoc> {
  const rows = checkLines(lines);
  if (rows.some((l) => !l.price || l.price <= 0)) throw new OneCError("Для оприходования укажите цену каждого товара");
  // Статья доходов and тип цен as in the last Оприходование made in 1С.
  const [{ org, account }, unit, last] = await Promise.all([
    context(),
    units(rows.map((l) => l.itemRef)),
    oneCGet<{ value?: { СтатьяПрочихДоходовРасходов_Key?: string; ТипЦен_Key?: string }[] }>(
      `/${q("Document_ОприходованиеТоваров")}?$top=1&$orderby=Date desc&$select=СтатьяПрочихДоходовРасходов_Key,ТипЦен_Key`
    ),
  ]);
  const prev = last.value?.[0];
  const sum = rows.reduce((s, l) => s + round2(l.qty * l.price!), 0);
  const { number } = await createPosted("Document_ОприходованиеТоваров", {
    Date: oneCDateTime(new Date()),
    Организация_Key: org,
    Склад_Key: warehouse,
    Комментарий: comment,
    СуммаДокумента: round2(sum),
    ...(prev?.СтатьяПрочихДоходовРасходов_Key ? { СтатьяПрочихДоходовРасходов_Key: prev.СтатьяПрочихДоходовРасходов_Key } : {}),
    ...(prev?.ТипЦен_Key ? { ТипЦен_Key: prev.ТипЦен_Key } : {}),
    ...(inventory ? { ИнвентаризацияТоваровНаСкладе_Key: inventory.ref, Основание: `Инвентаризация № ${inventory.number}` } : {}),
    Товары: rows.map((l, i) => ({
      LineNumber: String(i + 1),
      Номенклатура_Key: l.itemRef,
      ЕдиницаИзмерения_Key: unit.get(l.itemRef),
      Коэффициент: 1,
      Количество: l.qty,
      Цена: round2(l.price!),
      Сумма: round2(l.qty * l.price!),
      СчетУчета_Key: account,
    })),
  });
  if (!inventory) await afterWrite();
  return { kind: "Оприходование", number };
}

export type InventoryLine = { itemRef: string; book: number; fact: number; /** rubles, for surpluses */ price: number };

/** Инвентаризация with the counted quantities, then Списание of shortages and Оприходование of surpluses. */
export async function createInventory(warehouse: string, lines: InventoryLine[], comment: string): Promise<CreatedDoc[]> {
  const rows = lines.filter((l) => l.itemRef && l.fact >= 0);
  if (!rows.length) throw new OneCError("Нет строк для инвентаризации");
  const surplus = rows.filter((l) => l.fact > l.book);
  if (surplus.some((l) => !l.price || l.price <= 0)) throw new OneCError("Укажите цену для излишков — по ней они будут оприходованы");
  const { org, account } = await context();
  const now = oneCDateTime(new Date());
  const inventory = await createPosted("Document_ИнвентаризацияТоваровНаСкладе", {
    Date: now,
    Организация_Key: org,
    Склад_Key: warehouse,
    ДатаНачалаИнвентаризации: now,
    ДатаОкончанияИнвентаризации: now,
    СчетУчета_Key: account,
    Комментарий: comment,
    Товары: rows.map((l, i) => ({
      LineNumber: String(i + 1),
      Номенклатура_Key: l.itemRef,
      СчетУчета_Key: account,
      Количество: l.fact,
      КоличествоУчет: Math.max(0, l.book),
      Цена: round2(l.price),
      Сумма: round2(l.fact * l.price),
      СуммаУчет: round2(Math.max(0, l.book) * l.price),
    })),
  });
  const done: CreatedDoc[] = [{ kind: "Инвентаризация", number: inventory.number }];
  const shortage = rows.filter((l) => l.fact < l.book).map((l) => ({ itemRef: l.itemRef, qty: l.book - l.fact }));
  const extra = surplus.map((l) => ({ itemRef: l.itemRef, qty: l.fact - Math.max(0, l.book), price: l.price }));
  try {
    if (shortage.length) done.push(await createWriteOff(warehouse, shortage, comment, inventory));
    if (extra.length) done.push(await createReceipt(warehouse, extra, comment, inventory));
  } finally {
    await afterWrite();
  }
  return done;
}

// ---- Списание / Оприходование list ---------------------------------------

export type AdjustmentDoc = {
  ref: string;
  kind: "Списание" | "Оприходование";
  number: string;
  date: string;
  posted: boolean;
  deleted: boolean;
  warehouseRef: string;
  lines: number;
  sum: number;
  comment: string;
};

type RawAdjustment = {
  Ref_Key: string;
  Number: string;
  Date: string;
  Posted: boolean;
  DeletionMark: boolean;
  Склад_Key?: string;
  СуммаДокумента?: number;
  Комментарий?: string;
  Товары?: unknown[];
};

export async function listAdjustments(): Promise<AdjustmentDoc[]> {
  const fields = ["Ref_Key", "Number", "Date", "Posted", "DeletionMark", "Склад_Key", "СуммаДокумента", "Комментарий", "Товары"];
  const [writeOffs, receipts] = await Promise.all([
    oneCGetAll<RawAdjustment>("Document_СписаниеТоваров", fields),
    oneCGetAll<RawAdjustment>("Document_ОприходованиеТоваров", fields),
  ]);
  const map = (kind: AdjustmentDoc["kind"]) => (d: RawAdjustment): AdjustmentDoc => ({
    ref: d.Ref_Key,
    kind,
    number: d.Number.trim(),
    date: d.Date,
    posted: d.Posted,
    deleted: d.DeletionMark,
    warehouseRef: d.Склад_Key ?? EMPTY,
    lines: d.Товары?.length ?? 0,
    sum: d.СуммаДокумента ?? 0,
    comment: (d.Комментарий ?? "").trim(),
  });
  return [...writeOffs.map(map("Списание")), ...receipts.map(map("Оприходование"))].sort((a, b) => b.date.localeCompare(a.date));
}

// ---- Склады (Настройки → Склады) -----------------------------------------

export type WarehouseCard = { ref: string; name: string; type: string; comment: string; deleted: boolean };

export const WAREHOUSE_TYPES: Record<string, string> = {
  ОптовыйСклад: "Оптовый склад",
  РозничныйМагазин: "Розничный магазин",
  НеавтоматизированнаяТорговаяТочка: "Неавтоматизированная торговая точка",
};

export async function listWarehouseCards(): Promise<WarehouseCard[]> {
  const rows = await oneCGetAll<{ Ref_Key: string; Description: string; ТипСклада?: string; Комментарий?: string; DeletionMark: boolean; IsFolder: boolean }>(
    "Catalog_Склады",
    ["Ref_Key", "Description", "ТипСклада", "Комментарий", "DeletionMark", "IsFolder"]
  );
  return rows
    .filter((r) => !r.IsFolder)
    .map((r) => ({ ref: r.Ref_Key, name: r.Description.trim(), type: r.ТипСклада || "ОптовыйСклад", comment: (r.Комментарий ?? "").trim(), deleted: r.DeletionMark }))
    .sort((a, b) => Number(a.deleted) - Number(b.deleted) || a.name.localeCompare(b.name, "ru"));
}

export async function saveWarehouseCard(ref: string | null, data: { name: string; type: string; comment: string }) {
  const body = { Description: data.name, ТипСклада: data.type, Комментарий: data.comment };
  if (ref) await oneCSend("PATCH", `/${q("Catalog_Склады")}(guid'${ref}')`, body);
  else await oneCSend("POST", `/${q("Catalog_Склады")}`, body);
  await getWarehouseData(true).catch(() => {});
}
