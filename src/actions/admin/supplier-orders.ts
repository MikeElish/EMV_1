"use server";

import { revalidatePath } from "next/cache";
import { SupplierOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { accessDenied } from "@/lib/access-server";
import { applyPaymentTerms, setLineStatuses } from "@/lib/order-status";
import { SHIPPED_STATUSES } from "@/lib/validators/orders";
import { ORDER_STATUS_OF_SUPPLIER } from "@/lib/validators/supplier-orders";
import { orderSheetBase64, orderSheetFileName } from "@/lib/order-sheet";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type SheetResult = { ok: true; base64: string; fileName: string } | { ok: false; error: string };

const MAX_SHEET_ROWS = 20000;

/**
 * Status of a supplier order line; the customer order line it covers moves to
 * the matching status in CRM → Заказы (unless cancelled or already shipped).
 */
export async function updateSupplierOrderStatus(id: string, status: SupplierOrderStatus): Promise<ActionResult> {
  const denied = await accessDenied("crm.supplier-orders");
  if (denied) return denied;
  if (!Object.values(SupplierOrderStatus).includes(status)) return { ok: false, error: "Некорректный статус" };
  const line = await prisma.supplierOrderLine.findUnique({
    where: { id },
    include: { orderItem: { select: { id: true, orderId: true, status: true } } },
  });
  if (!line) return { ok: false, error: "Позиция не найдена" };

  await prisma.supplierOrderLine.update({ where: { id }, data: { status } });
  const item = line.orderItem;
  const next = ORDER_STATUS_OF_SUPPLIER[status];
  if (item && item.status !== next && item.status !== "CANCELLED" && !SHIPPED_STATUSES.includes(item.status)) {
    await setLineStatuses(item.orderId, [{ itemId: item.id, status: next }], { notify: true });
    // Проверено on a line already paid (or on deferral) goes straight on to
    // «Ожидание поставки» -- and this line to «Заказать».
    if (next === "AWAITING_PAYMENT") await applyPaymentTerms(item.orderId);
  }
  revalidatePath("/admin/crm/supplier-orders");
  revalidatePath("/admin/crm/price-check");
  revalidatePath("/admin/crm/orders");
  revalidatePath("/admin/crm/products");
  revalidatePath("/shop/orders");
  return { ok: true };
}

/** «Выгрузка» in Заказ поставщику: the listed lines as an Excel request. */
export async function exportSupplierOrders(ids: string[]): Promise<SheetResult> {
  const denied = await accessDenied("crm.supplier-orders", "view");
  if (denied) return denied;
  if (!ids.length) return { ok: false, error: "Нет позиций для выгрузки" };
  if (ids.length > MAX_SHEET_ROWS) return { ok: false, error: "Слишком много позиций" };
  const lines = await prisma.supplierOrderLine.findMany({
    where: { id: { in: ids } },
    include: { product: { select: { brand: true, name: true, sku: true } } },
  });
  const byId = new Map(lines.map((l) => [l.id, l]));
  const rows = ids.flatMap((id) => {
    const l = byId.get(id);
    return l ? [{ ...l.product, quantity: l.quantity, deliveryDays: l.deliveryDays }] : [];
  });
  return { ok: true, base64: orderSheetBase64(rows), fileName: orderSheetFileName("Заказ поставщику") };
}

/**
 * «Выгрузка» in Проценка: the listed nomenclature as an Excel request.
 * Количество -- what customer lines in «Проверка заказа» need; Срок поставки
 * -- of the selected offer.
 */
export async function exportPriceCheck(productIds: string[]): Promise<SheetResult> {
  const denied = await accessDenied("crm.price-check", "view");
  if (denied) return denied;
  if (!productIds.length) return { ok: false, error: "Нет позиций для выгрузки" };
  if (productIds.length > MAX_SHEET_ROWS) return { ok: false, error: "Слишком много позиций" };
  const [products, checking, offers] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, brand: true, name: true, sku: true } }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: { productId: { in: productIds }, status: "CHECKING" },
      _sum: { quantity: true },
    }),
    prisma.supplierOffer.findMany({ where: { productId: { in: productIds }, selected: true }, select: { productId: true, deliveryDays: true } }),
  ]);
  const byId = new Map(products.map((p) => [p.id, p]));
  const quantityOf = new Map(checking.map((c) => [c.productId, c._sum.quantity]));
  const daysOf = new Map(offers.map((o) => [o.productId, o.deliveryDays]));
  const rows = productIds.flatMap((id) => {
    const p = byId.get(id);
    return p ? [{ ...p, quantity: quantityOf.get(id) ?? null, deliveryDays: daysOf.get(id) ?? null }] : [];
  });
  return { ok: true, base64: orderSheetBase64(rows), fileName: orderSheetFileName("Проценка") };
}

/** Срок поставки of a supplier order line, days (empty -- not known). */
export async function updateSupplierOrderDays(id: string, days: number | null): Promise<ActionResult> {
  const denied = await accessDenied("crm.supplier-orders");
  if (denied) return denied;
  if (days !== null && (!Number.isInteger(days) || days < 0 || days > 365)) {
    return { ok: false, error: "Срок поставки — целое число дней от 0 до 365" };
  }
  const updated = await prisma.supplierOrderLine.updateMany({ where: { id }, data: { deliveryDays: days } });
  if (!updated.count) return { ok: false, error: "Позиция не найдена" };
  revalidatePath("/admin/crm/supplier-orders");
  return { ok: true };
}
