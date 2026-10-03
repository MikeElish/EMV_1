"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-dal";
import { OneCError } from "@/lib/onec";
import {
  applyCounterparties,
  computeProductMatching,
  importGoodsAsInactive,
  linkProduct,
  loadOneCGoods,
  planCounterparties,
  type CounterpartyPlan,
  type OneCGood,
  type ProductMatching,
} from "@/lib/onec-sync";

const PAGE = "/admin/settings/1c/matching";
const CACHE_MS = 60 * 1000;

// The 1С catalog is read once a minute at most; actions drop the cache.
const globalCache = globalThis as unknown as { __emvOneCGoods?: { at: number; data: Promise<OneCGood[]> } };
function goods(): Promise<OneCGood[]> {
  const hit = globalCache.__emvOneCGoods;
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;
  const data = loadOneCGoods();
  globalCache.__emvOneCGoods = { at: Date.now(), data };
  data.catch(() => {
    if (globalCache.__emvOneCGoods?.data === data) globalCache.__emvOneCGoods = undefined;
  });
  return data;
}

function fail(error: unknown): { ok: false; error: string } {
  if (error instanceof OneCError) return { ok: false, error: error.message };
  console.error("[1c-sync] failed:", error);
  return { ok: false, error: "Не удалось выполнить операцию с 1С" };
}

export type MatchingOverview =
  | { ok: true; products: ProductMatching; counterparties: CounterpartyPlan; totalGoods: number }
  | { ok: false; error: string };

export async function getMatchingOverview(): Promise<MatchingOverview> {
  await verifyAdminSession();
  try {
    const all = await goods();
    const [products, counterparties] = await Promise.all([computeProductMatching(all), planCounterparties()]);
    return { ok: true, products, counterparties, totalGoods: all.length };
  } catch (error) {
    return fail(error);
  }
}

export type SyncResult = { ok: true; message: string } | { ok: false; error: string };

/** Links every product whose SKU matches exactly one free 1С card. */
export async function linkAutomatically(): Promise<SyncResult> {
  await verifyAdminSession();
  try {
    const { auto } = await computeProductMatching(await goods());
    let linked = 0;
    for (const { product, good } of auto) {
      linked += await linkProduct(product.id, [good.ref]);
    }
    revalidatePath(PAGE);
    return { ok: true, message: `Связано по артикулу: ${linked}` };
  } catch (error) {
    return fail(error);
  }
}

/** Manual decision: link to the chosen 1С card(s), or «нет в 1С» (refs = null). */
export async function resolveProduct(productId: string, refs: string[] | null): Promise<SyncResult> {
  await verifyAdminSession();
  try {
    if (refs?.length) {
      const known = new Set((await goods()).map((g) => g.ref));
      if (refs.some((r) => !known.has(r))) return { ok: false, error: "Карточка 1С не найдена — обновите страницу" };
      const taken = await prisma.oneCProductLink.findFirst({
        where: { ref: { in: refs }, NOT: { productId } },
        select: { product: { select: { sku: true } } },
      });
      if (taken) return { ok: false, error: `Карточка 1С уже связана с товаром ${taken.product.sku}` };
      await linkProduct(productId, refs);
    } else {
      await prisma.oneCProductLink.deleteMany({ where: { productId } });
      await prisma.product.update({ where: { id: productId }, data: { oneCNoMatch: true } });
    }
    revalidatePath(PAGE);
    return { ok: true, message: refs?.length ? "Связано" : "Отмечено: в 1С такого товара нет" };
  } catch (error) {
    return fail(error);
  }
}

/** 1С goods with no site product become inactive products (after all decisions are made). */
export async function importOneCGoods(): Promise<SyncResult> {
  await verifyAdminSession();
  try {
    const matching = await computeProductMatching(await goods());
    const pending = matching.auto.length + matching.ambiguous.length + matching.byName.length;
    if (pending > 0) {
      return {
        ok: false,
        error: `Сначала разберите сопоставление (осталось ${pending}), иначе одинаковые товары задвоятся`,
      };
    }
    const created = await importGoodsAsInactive(matching.oneCOnly);
    revalidatePath(PAGE);
    revalidatePath("/admin/crm/products");
    return { ok: true, message: `Добавлено неактивных товаров: ${created}. Они в категории «Из 1С — не распределено».` };
  } catch (error) {
    return fail(error);
  }
}

export async function importCounterparties(): Promise<SyncResult> {
  await verifyAdminSession();
  try {
    const result = await applyCounterparties(await planCounterparties());
    revalidatePath(PAGE);
    revalidatePath("/admin/crm/companies");
    return { ok: true, message: `Создано компаний: ${result.created}, связано по ИНН: ${result.linked}` };
  } catch (error) {
    return fail(error);
  }
}
