import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { oneCGet } from "@/lib/onec";

// «Наличие» of products linked to 1С comes from 1С:Бухгалтерия: the balance
// of the goods accounts by item, summed over a product's 1С cards. Products
// with no 1С card keep the stock entered on the site. Runs at 06:00 and
// 18:00 Moscow time and from Настройки → 1С.

/** Goods for sale: on warehouses, in retail, bought-in items. */
export const GOODS_ACCOUNTS = ["41.01", "41.02", "41.04"];
const ITEM_TYPE = "StandardODATA.Catalog_Номенклатура";

type BalanceRow = { ExtDimension1?: string; ExtDimension1_Type?: string; КоличествоBalance?: number };

/** 1С's datetime literal for a moment, in Moscow time (1С keeps local time). */
export function oneCDateTime(date: Date) {
  return date.toLocaleString("sv-SE", { timeZone: "Europe/Moscow" }).replace(" ", "T");
}

/** Quantity on the goods accounts per 1С item (Catalog_Номенклатура Ref_Key). */
async function loadOneCBalances(at: Date): Promise<Map<string, number>> {
  const q = encodeURIComponent;
  const chart = await oneCGet<{ value?: { Ref_Key: string; Code: string }[] }>(
    `/${q("ChartOfAccounts_Хозрасчетный")}?$select=Ref_Key,Code`
  );
  const accounts = (chart.value ?? []).filter((a) => GOODS_ACCOUNTS.includes(a.Code.trim()));
  const qty = new Map<string, number>();
  for (const account of accounts) {
    const res = await oneCGet<{ value?: BalanceRow[] }>(
      `/${q("AccountingRegister_Хозрасчетный")}/Balance(Period=datetime'${oneCDateTime(at)}',AccountCondition='${q(
        `Account_Key eq guid'${account.Ref_Key}'`
      )}')`
    );
    for (const row of res.value ?? []) {
      if (row.ExtDimension1_Type !== ITEM_TYPE || !row.ExtDimension1) continue;
      qty.set(row.ExtDimension1, (qty.get(row.ExtDimension1) ?? 0) + (row.КоличествоBalance ?? 0));
    }
  }
  return qty;
}

export type StockSyncResult = { linked: number; inStock: number; changed: number; restocked: number };

export async function syncStockFromOneC(): Promise<StockSyncResult> {
  const now = new Date();
  const balances = await loadOneCBalances(now);
  const products = await prisma.product.findMany({
    where: { oneCLinks: { some: {} } },
    select: { id: true, stock: true, oneCLinks: { select: { ref: true } } },
  });

  const result: StockSyncResult = { linked: products.length, inStock: 0, changed: 0, restocked: 0 };
  for (const p of products) {
    // Whole pieces: litres and metres of a 1С balance round down.
    const stock = Math.max(0, Math.floor(p.oneCLinks.reduce((sum, l) => sum + (balances.get(l.ref) ?? 0), 0) + 1e-9));
    if (stock > 0) result.inStock++;
    if (stock === p.stock) continue;
    const restocked = stock > p.stock;
    await prisma.product.update({
      where: { id: p.id },
      // Restocked products share one timestamp, like an upload: «Новое поступление».
      data: { stock, ...(restocked ? { newArrivalAt: now } : {}) },
    });
    result.changed++;
    if (restocked) result.restocked++;
  }

  const summary = `Связано с 1С: ${result.linked}, в наличии: ${result.inStock}, изменено: ${result.changed} (поступило: ${result.restocked})`;
  await prisma.oneCSettings.update({ where: { id: 1 }, data: { stockSyncedAt: now, stockSyncSummary: summary } });
  try {
    revalidatePath("/shop", "layout");
    revalidatePath("/admin/crm/products");
  } catch {
    // Outside a request (the daily timer) there is nothing cached to drop.
  }
  return result;
}

const timerState = globalThis as unknown as { oneCStockTimer?: ReturnType<typeof setTimeout> };

/** Milliseconds until the next 06:00 or 18:00 Moscow time (UTC+3, no DST). */
function untilNextRun(now = Date.now()) {
  const period = 12 * 60 * 60 * 1000;
  const sixMsk = 3 * 60 * 60 * 1000;
  const wait = (sixMsk - (now % period) + period) % period;
  return wait || period;
}

/** Started from src/instrumentation.ts. */
export function startOneCStockTimer() {
  if (timerState.oneCStockTimer) return;
  const schedule = () => {
    timerState.oneCStockTimer = setTimeout(async () => {
      try {
        if (await prisma.oneCSettings.findUnique({ where: { id: 1 }, select: { id: true } })) {
          const r = await syncStockFromOneC();
          console.log("[1c-stock] synced", r);
        }
      } catch (error) {
        console.error("[1c-stock] sync failed", error);
        await prisma.oneCSettings
          .update({
            where: { id: 1 },
            data: { stockSyncedAt: new Date(), stockSyncSummary: `Ошибка: ${error instanceof Error ? error.message : "1С не ответила"}` },
          })
          .catch(() => {});
      }
      schedule();
    }, untilNextRun());
  };
  schedule();
}
