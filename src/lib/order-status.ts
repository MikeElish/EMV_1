import type { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ORDER_STATUS_PROGRESS,
  SHIPPED_STATUSES,
  STOCK_HOLDING_STATUSES,
} from "@/lib/validators/orders";
import { noticeLineStatusChanges } from "@/lib/order-notifications";

// Order lines carry their own status; the order's status is derived from
// them. Every status change goes through setLineStatuses so stock, totals,
// the shipping date and the customer's letters stay consistent.

type Db = Prisma.TransactionClient | typeof prisma;

/** The lines' common status, or the least advanced one while they differ. */
export function aggregateOrderStatus(statuses: OrderStatus[]): OrderStatus {
  const active = statuses.filter((s) => s !== "CANCELLED");
  if (!active.length) return "CANCELLED";
  return active.reduce((min, s) =>
    ORDER_STATUS_PROGRESS.indexOf(s) < ORDER_STATUS_PROGRESS.indexOf(min) ? s : min
  );
}

/** On the shelf minus what in-stock reserved lines already hold, per product. */
export async function freeStock(db: Db, productIds: string[]): Promise<Map<string, number>> {
  const ids = [...new Set(productIds)];
  const [products, held] = await Promise.all([
    db.product.findMany({ where: { id: { in: ids } }, select: { id: true, stock: true } }),
    db.orderItem.groupBy({
      by: ["productId"],
      where: { productId: { in: ids }, status: { in: STOCK_HOLDING_STATUSES }, stockWrittenOff: false },
      _sum: { quantity: true },
    }),
  ]);
  const heldBy = new Map(held.map((h) => [h.productId, h._sum.quantity ?? 0]));
  return new Map(products.map((p) => [p.id, p.stock - (heldBy.get(p.id) ?? 0)]));
}

/**
 * Statuses for the lines of a new order: not enough free stock -> Проверка
 * заказа; in stock -> Готов к отгрузке when paid or on deferral, else
 * Требуется оплата.
 */
export async function initialLineStatuses(
  lines: { productId: string; quantity: number }[],
  canShip: boolean
): Promise<OrderStatus[]> {
  const left = await freeStock(prisma, lines.map((l) => l.productId));
  return lines.map((line) => {
    const free = left.get(line.productId) ?? 0;
    if (free < line.quantity) return "CHECKING";
    if (!canShip) return "AWAITING_PAYMENT";
    left.set(line.productId, free - line.quantity);
    return "READY_TO_SHIP";
  });
}

export type LineStatusChange = { itemId: string; status: OrderStatus };

/**
 * Applies new statuses to lines of one order: syncs `cancelled`, takes
 * shipped lines off stock (and puts them back if a shipment is undone),
 * recomputes the total and the order status, stamps the shipping date, and
 * -- with `notify` -- writes to the customer.
 */
export async function setLineStatuses(
  orderId: string,
  changes: LineStatusChange[],
  { notify }: { notify: boolean }
): Promise<{ changed: string[] } | null> {
  const wanted = new Map(changes.map((c) => [c.itemId, c.status]));

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        user: { select: { company: { select: { paymentType: true, paymentDeferralDays: true } } } },
      },
    });
    if (!order) return null;

    const changed: string[] = [];
    let shippedNow = false;
    const lines = order.items.map((item) => ({ ...item, status: wanted.get(item.id) ?? item.status }));

    for (const item of order.items) {
      const next = wanted.get(item.id);
      if (!next || next === item.status) continue;
      changed.push(item.id);

      let stockWrittenOff = item.stockWrittenOff;
      const isShipped = SHIPPED_STATUSES.includes(next);
      if (isShipped !== stockWrittenOff) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: isShipped ? { decrement: item.quantity } : { increment: item.quantity } },
        });
        stockWrittenOff = isShipped;
      }
      if (next === "SHIPPED_AWAITING_PAYMENT") shippedNow = true;

      await tx.orderItem.update({
        where: { id: item.id },
        data: { status: next, cancelled: next === "CANCELLED", stockWrittenOff },
      });
    }
    if (!changed.length) return { changed };

    const data: Prisma.OrderUpdateInput = {
      status: aggregateOrderStatus(lines.map((l) => l.status)),
      totalAmount: lines
        .filter((l) => l.status !== "CANCELLED")
        .reduce((sum, l) => sum + l.priceSnapshot * l.quantity, 0),
    };
    // Stamped only the first time something ships -- a later re-entry (after
    // a correction) doesn't push the date forward.
    if (shippedNow && !order.shippedAt) {
      const shippedAt = new Date();
      data.shippedAt = shippedAt;
      const company = order.user?.company;
      if (company?.paymentType === "DEFERRED" && company.paymentDeferralDays) {
        const planned = new Date(shippedAt);
        planned.setDate(planned.getDate() + company.paymentDeferralDays);
        data.plannedPaymentDate = planned;
      }
    }
    await tx.order.update({ where: { id: orderId }, data });
    return { changed };
  });

  if (result?.changed.length && notify) {
    await noticeLineStatusChanges(orderId, result.changed);
  }
  return result;
}

/**
 * Payment terms of an order changed (paid / deferral). Lines waiting for
 * payment move on to Готов к отгрузке (in stock) or Ожидание поставки; if
 * the order can no longer ship, those two go back to Требуется оплата.
 */
export async function applyPaymentTerms(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { paid: true, deferred: true, items: { orderBy: { id: "asc" } } },
  });
  if (!order) return;

  const changes: LineStatusChange[] = [];
  if (order.paid || order.deferred) {
    const waiting = order.items.filter((i) => i.status === "AWAITING_PAYMENT");
    const left = await freeStock(prisma, waiting.map((i) => i.productId));
    for (const item of waiting) {
      const free = left.get(item.productId) ?? 0;
      if (free >= item.quantity) {
        left.set(item.productId, free - item.quantity);
        changes.push({ itemId: item.id, status: "READY_TO_SHIP" });
      } else {
        changes.push({ itemId: item.id, status: "AWAITING_SUPPLY" });
      }
    }
  } else {
    for (const item of order.items) {
      if (item.status === "READY_TO_SHIP" || item.status === "AWAITING_SUPPLY") {
        changes.push({ itemId: item.id, status: "AWAITING_PAYMENT" });
      }
    }
  }
  if (changes.length) await setLineStatuses(orderId, changes, { notify: true });
}

/**
 * Stock of these products went up: lines waiting for supply get the goods,
 * oldest orders first, while free stock lasts.
 */
export async function releaseAwaitingSupply(productIds: string[]) {
  if (!productIds.length) return;
  const waiting = await prisma.orderItem.findMany({
    where: { productId: { in: productIds }, status: "AWAITING_SUPPLY" },
    select: { id: true, orderId: true, productId: true, quantity: true },
    orderBy: { order: { createdAt: "asc" } },
  });
  if (!waiting.length) return;

  const left = await freeStock(prisma, waiting.map((w) => w.productId));
  const byOrder = new Map<string, LineStatusChange[]>();
  for (const line of waiting) {
    const free = left.get(line.productId) ?? 0;
    if (free < line.quantity) continue;
    left.set(line.productId, free - line.quantity);
    const list = byOrder.get(line.orderId) ?? [];
    list.push({ itemId: line.id, status: "READY_TO_SHIP" });
    byOrder.set(line.orderId, list);
  }
  for (const [orderId, changes] of byOrder) {
    await setLineStatuses(orderId, changes, { notify: true });
  }
}
