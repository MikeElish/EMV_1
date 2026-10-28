import "server-only";
import { prisma } from "@/lib/prisma";
import { freeStock, refreshOrder } from "@/lib/order-status";

// Lines «Под заказ» (those that went to Заказ поставщику) of an order:
//  1. together under 10 000 ₽ -- 1 500 ₽ more;
//  2. then a margin under 2 000 ₽ -- raised to 2 500 ₽.
// The extra is shared evenly between those lines, per unit, and kept apart
// in OrderItem.surcharge, so a recount never stacks it. Counted once every
// such line has a price; frozen once one of them is paid.

const SMALL_ORDER_LIMIT = 10_000_00;
const SMALL_ORDER_FEE = 1_500_00;
const MIN_MARGIN = 2_000_00;
const TARGET_MARGIN = 2_500_00;

type Line = { base: number; quantity: number; purchase: number | null };

/** Per-unit surcharge of each line (kopecks). The margin rule needs every purchase price. */
export function surchargesFor(lines: Line[]): number[] {
  if (!lines.length) return [];
  const sum = lines.reduce((s, l) => s + l.base * l.quantity, 0);
  let extra = sum < SMALL_ORDER_LIMIT ? SMALL_ORDER_FEE : 0;
  if (lines.every((l) => l.purchase !== null)) {
    const margin = sum + extra - lines.reduce((s, l) => s + l.purchase! * l.quantity, 0);
    if (margin < MIN_MARGIN) extra += TARGET_MARGIN - margin;
  }
  if (extra <= 0) return lines.map(() => 0);
  const share = extra / lines.length;
  return lines.map((l) => Math.ceil(share / l.quantity));
}

/**
 * Checkout: the per-unit surcharge each cart line would get -- lines short of
 * free stock are «Под заказ»; nothing while one of them has no price yet.
 */
export async function quoteSurcharges(
  lines: { productId: string; quantity: number; price: number; offerId?: string }[]
): Promise<number[]> {
  const left = await freeStock(prisma, lines.map((l) => l.productId));
  const toOrder = lines.map((l) => {
    const free = left.get(l.productId) ?? 0;
    left.set(l.productId, free - l.quantity);
    return free < l.quantity;
  });
  const picked = lines.filter((_, n) => toOrder[n]);
  if (!picked.length || picked.some((l) => l.price <= 0)) return lines.map(() => 0);

  const ids = picked.map((l) => l.productId);
  const [offers, pricing] = await Promise.all([
    prisma.supplierOffer.findMany({
      where: { OR: [{ productId: { in: ids }, selected: true }, { id: { in: picked.flatMap((l) => (l.offerId ? [l.offerId] : [])) } }] },
      select: { id: true, productId: true, price: true, selected: true },
    }),
    prisma.productPricing.findMany({ where: { productId: { in: ids } }, select: { productId: true, purchasePrice: true } }),
  ]);
  const purchaseOf = (l: (typeof picked)[number]) =>
    (l.offerId && offers.find((o) => o.id === l.offerId)?.price) ||
    offers.find((o) => o.productId === l.productId && o.selected)?.price ||
    pricing.find((p) => p.productId === l.productId)?.purchasePrice ||
    null;
  const per = surchargesFor(picked.map((l) => ({ base: l.price, quantity: l.quantity, purchase: purchaseOf(l) })));
  let n = 0;
  return lines.map((_, i) => (toOrder[i] ? per[n++] : 0));
}

/** Recounts the surcharges of the order's lines «Под заказ»; the order total follows. */
export async function applyOrderSurcharges(orderId: string) {
  const items = await prisma.orderItem.findMany({
    where: { orderId, status: { not: "CANCELLED" }, supplierOrderLines: { some: {} } },
    orderBy: { id: "asc" },
    select: {
      id: true,
      priceSnapshot: true,
      surcharge: true,
      quantity: true,
      paid: true,
      supplierOrderLines: { where: { price: { gt: 0 } }, select: { price: true }, take: 1 },
      offer: { select: { price: true } },
      product: { select: { offers: { where: { selected: true }, select: { price: true } }, pricing: { select: { purchasePrice: true } } } },
    },
  });
  if (!items.length || items.some((i) => i.paid)) return;
  const lines = items.map((i) => ({
    base: i.priceSnapshot - i.surcharge,
    quantity: i.quantity,
    purchase:
      i.supplierOrderLines[0]?.price ||
      i.offer?.price ||
      i.product.offers[0]?.price ||
      i.product.pricing?.purchasePrice ||
      null,
  }));
  if (lines.some((l) => l.base <= 0)) return;

  const next = surchargesFor(lines);
  let changed = false;
  for (const [n, item] of items.entries()) {
    if (item.surcharge === next[n]) continue;
    changed = true;
    await prisma.orderItem.update({
      where: { id: item.id },
      data: { surcharge: next[n], priceSnapshot: lines[n].base + next[n] },
    });
  }
  if (changed) await refreshOrder(prisma, orderId);
}
