"use server";

import { revalidatePath } from "next/cache";
import { SupplierOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { accessDenied, assignedManagerDenied, getMyAccess, ownerOnly, requireSection } from "@/lib/access-server";
import { applyPaymentTerms, setLineStatuses } from "@/lib/order-status";
import { SHIPPED_STATUSES } from "@/lib/validators/orders";
import { ORDER_STATUS_OF_SUPPLIER } from "@/lib/validators/supplier-orders";
import { orderSheetBase64, orderSheetFileName } from "@/lib/order-sheet";
import { addPurchaseFile } from "@/lib/supplier-purchases";
import { ownerManualInputEnabled } from "@/lib/manual-input";
import { priceWithSupplierLogistics } from "@/lib/supplier-pricing";
import { parseSupplierCurrency } from "@/lib/supplier-currency";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type SheetResult = { ok: true; base64: string; fileName: string } | { ok: false; error: string };
type PurchaseResult = { ok: true; message: string } | { ok: false; error: string };

const MAX_SHEET_ROWS = 20000;

async function supplierLinesAssignmentDenied(ids: string | string[]) {
  const me = await getMyAccess();
  if (!me) return { ok: false as const, error: "Требуется вход" };
  if (me.role === "OWNER") return null;
  const lines = await prisma.supplierOrderLine.findMany({
    where: { id: { in: Array.isArray(ids) ? ids : [ids] } },
    select: {
      buyerOrderNumber: true,
      orderItem: { select: { order: { select: { managerId: true } } } },
    },
  });
  if (!lines.length) return { ok: false as const, error: "Позиция не найдена" };
  const orderNumbers = [...new Set(lines.map((line) => line.buyerOrderNumber).filter((value): value is string => !!value))];
  const orders = orderNumbers.length
    ? await prisma.order.findMany({ where: { orderNumber: { in: orderNumbers } }, select: { orderNumber: true, managerId: true } })
    : [];
  const managerByOrderNumber = new Map(orders.map((order) => [order.orderNumber, order.managerId]));
  const denied = await assignedManagerDenied(
    lines.every((line) => (line.orderItem?.order.managerId ?? managerByOrderNumber.get(line.buyerOrderNumber ?? "") ?? null) === me.userId)
      ? me.userId
      : null
  );
  return denied;
}

export async function getManualSupplierOrderFormData() {
  await requireSection("crm.supplier-orders", "view");
  if (!(await ownerManualInputEnabled())) throw new Error("Ручной ввод выключен в настройках сайта");
  const [products, suppliers, buyerOrders] = await Promise.all([
    prisma.product.findMany({
      select: { id: true, sku: true, name: true, brand: true, stock: true, pricing: { select: { purchasePrice: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.company.findMany({
      where: { isOwn: false, OR: [{ type: "Поставщик" }, { supplierOrderLines: { some: {} } }] },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.order.findMany({
      where: { items: { some: { cancelled: false, status: { notIn: ["DONE", "CANCELLED"] } } } },
      select: {
        orderNumber: true,
        customerName: true,
        buyerCompany: { select: { name: true } },
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);
  return {
    products: products.map((product) => ({ ...product, purchasePrice: product.pricing?.purchasePrice ?? 0 })),
    suppliers,
    buyerOrders: buyerOrders.map((order) => ({
      orderNumber: order.orderNumber,
      customerName: order.buyerCompany?.name ?? order.customerName,
      createdAt: order.createdAt.toISOString(),
    })),
  };
}

export async function addManualSupplierOrderLine(
  productId: string,
  supplierId: string,
  quantity: number,
  price: number,
  purchaseTarget: string
): Promise<ActionResult> {
  const denied = await accessDenied("crm.supplier-orders");
  if (denied) return denied;
  const ownerDenied = await ownerOnly();
  if (ownerDenied) return ownerDenied;
  if (!(await ownerManualInputEnabled())) return { ok: false, error: "Добавлять позиции может владелец при включённом ручном вводе" };
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100_000) return { ok: false, error: "Укажите количество от 1 до 100 000" };
  if (!Number.isInteger(price) || price < 0 || price > 1_000_000_000) return { ok: false, error: "Укажите цену в копейках, не меньше нуля" };
  if (typeof purchaseTarget !== "string" || purchaseTarget.length > 120) {
    return { ok: false, error: "Некорректная привязка закупки" };
  }
  const target = purchaseTarget.trim();
  const forStock = target === "warehouse";
  const normalizedBuyerOrderNumber = target.startsWith("order:") ? target.slice("order:".length).trim() : "";
  if (target && !forStock && !normalizedBuyerOrderNumber) {
    return { ok: false, error: "Выберите заказ покупателя или «На склад»" };
  }
  if (normalizedBuyerOrderNumber.length > 100) {
    return { ok: false, error: "Номер заказа покупателя не должен превышать 100 символов" };
  }
  if (normalizedBuyerOrderNumber) {
    const buyerOrder = await prisma.order.findUnique({
      where: {
        orderNumber: normalizedBuyerOrderNumber,
        items: { some: { cancelled: false, status: { notIn: ["DONE", "CANCELLED"] } } },
      },
      select: { orderNumber: true },
    });
    if (!buyerOrder) return { ok: false, error: "Выберите заказ с незавершёнными позициями" };
  }

  const [product, supplier] = await Promise.all([
    prisma.product.findUnique({ where: { id: productId }, select: { id: true } }),
    supplierId ? prisma.company.findUnique({
      where: { id: supplierId },
      select: { id: true, isOwn: true, supplierProfile: { select: { logisticsMarkupPercent: true } } },
    }) : Promise.resolve(null),
  ]);
  if (!product) return { ok: false, error: "Товар не найден" };
  if (supplierId && (!supplier || supplier.isOwn)) return { ok: false, error: "Поставщик не найден" };

  await prisma.supplierOrderLine.create({
    data: {
      productId,
      supplierId: supplier?.id ?? null,
      quantity,
      price: priceWithSupplierLogistics(price, supplier?.supplierProfile?.logisticsMarkupPercent ?? 0),
      quotedPrice: price,
      buyerOrderNumber: normalizedBuyerOrderNumber || null,
      forStock,
      status: "TO_ORDER",
    },
  });
  revalidatePath("/admin/crm/supplier-orders");
  revalidatePath("/admin/warehouse/replenishment");
  return { ok: true };
}

export async function changeSupplierOrderOffer(lineId: string, offerId: string): Promise<ActionResult> {
  const denied = await accessDenied("crm.supplier-orders");
  if (denied) return denied;
  const assignmentDenied = await supplierLinesAssignmentDenied(lineId);
  if (assignmentDenied) return assignmentDenied;
  if (typeof lineId !== "string" || !lineId || lineId.length > 200 ||
      typeof offerId !== "string" || !offerId || offerId.length > 200) {
    return { ok: false, error: "Выберите предложение поставщика" };
  }
  const line = await prisma.supplierOrderLine.findUnique({ where: { id: lineId }, select: { productId: true, purchaseId: true } });
  if (!line) return { ok: false, error: "Позиция не найдена" };
  if (line.purchaseId) return { ok: false, error: "Поставщик уже получил заказ — изменить выбор нельзя" };
  const offer = await prisma.supplierOffer.findFirst({
    where: {
      id: offerId,
      productId: line.productId,
      supplierId: { not: null },
      supplier: { is: { isOwn: false } },
      price: { gt: 0 },
    },
    include: { supplier: { select: { supplierProfile: { select: { logisticsMarkupPercent: true } } } } },
  });
  if (!offer?.supplierId) return { ok: false, error: "Предложение для этой позиции не найдено" };
  const markup = offer.supplier?.supplierProfile?.logisticsMarkupPercent ?? 0;
  const currency = parseSupplierCurrency(offer.currency) ?? "RUB";
  await prisma.supplierOrderLine.update({
    where: { id: lineId },
    data: {
      supplierId: offer.supplierId,
      offerId: offer.id,
      quotedPrice: offer.quotedPrice ?? offer.price,
      currency,
      exchangeRate: offer.exchangeRate,
      logisticsMarkupPercent: offer.logisticsMarkupPercent,
      price: currency === "RUB" ? priceWithSupplierLogistics(offer.price, markup) : offer.price,
      deliveryDays: offer.deliveryDays,
      quality: offer.quality,
      warehouse: offer.warehouse,
      noOffer: false,
    },
  });
  revalidatePath("/admin/crm/supplier-orders");
  return { ok: true };
}

/**
 * Status of a supplier order line; the customer order line it covers moves to
 * the matching status in CRM → Заказы (unless cancelled or already shipped).
 */
export async function updateSupplierOrderStatus(id: string, status: SupplierOrderStatus): Promise<ActionResult> {
  const denied = await accessDenied("crm.supplier-orders");
  if (denied) return denied;
  const assignmentDenied = await supplierLinesAssignmentDenied(id);
  if (assignmentDenied) return assignmentDenied;
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
  revalidatePath("/admin/warehouse/replenishment");
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
    return l ? [{
      ...l.product,
      quantity: l.quantity,
      deliveryDays: l.deliveryDays,
      quotedPrice: l.quotedPrice ?? l.price,
      currency: l.currency,
    }] : [];
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
    prisma.supplierOffer.findMany({
      where: { productId: { in: productIds }, selected: true, noOffer: false },
      select: { productId: true, deliveryDays: true, quotedPrice: true, price: true, currency: true },
    }),
  ]);
  const byId = new Map(products.map((p) => [p.id, p]));
  const quantityOf = new Map(checking.map((c) => [c.productId, c._sum.quantity]));
  const daysOf = new Map(offers.map((o) => [o.productId, o.deliveryDays]));
  const offerOf = new Map(offers.map((o) => [o.productId, o]));
  const rows = productIds.flatMap((id) => {
    const p = byId.get(id);
    const offer = offerOf.get(id);
    return p ? [{
      ...p,
      quantity: quantityOf.get(id) ?? null,
      deliveryDays: daysOf.get(id) ?? null,
      quotedPrice: offer ? offer.quotedPrice ?? offer.price : null,
      currency: offer?.currency ?? "RUB",
    }] : [];
  });
  return { ok: true, base64: orderSheetBase64(rows), fileName: orderSheetFileName("Проценка") };
}

/** Срок поставки of a supplier order line, days (empty -- not known). */
export async function updateSupplierOrderDays(id: string, days: number | null): Promise<ActionResult> {
  const denied = await accessDenied("crm.supplier-orders");
  if (denied) return denied;
  const assignmentDenied = await supplierLinesAssignmentDenied(id);
  if (assignmentDenied) return assignmentDenied;
  if (days !== null && (!Number.isInteger(days) || days < 0 || days > 365)) {
    return { ok: false, error: "Срок поставки — целое число дней от 0 до 365" };
  }
  const updated = await prisma.supplierOrderLine.updateMany({ where: { id }, data: { deliveryDays: days } });
  if (!updated.count) return { ok: false, error: "Позиция не найдена" };
  revalidatePath("/admin/crm/supplier-orders");
  return { ok: true };
}

/**
 * Mark a supplier order line as «Нет предложения» — the supplier confirmed
 * they cannot supply this item (no offer / out of stock).
 */
export async function toggleNoOffer(id: string): Promise<ActionResult> {
  const denied = await accessDenied("crm.supplier-orders");
  if (denied) return denied;
  const assignmentDenied = await supplierLinesAssignmentDenied(id);
  if (assignmentDenied) return assignmentDenied;
  const line = await prisma.supplierOrderLine.findUnique({ where: { id }, select: { id: true, noOffer: true } });
  if (!line) return { ok: false, error: "Позиция не найдена" };
  const current = line.noOffer;
  await prisma.supplierOrderLine.update({ where: { id }, data: { noOffer: !current } });
  revalidatePath("/admin/crm/supplier-orders");
  revalidatePath("/admin/crm/price-check");
  return { ok: true };
}

/** A supplier's invoice that came another way: into the line's supplier order (made if not sent yet). */
export async function uploadSupplierInvoice(formData: FormData): Promise<PurchaseResult> {
  const denied = await accessDenied("crm.supplier-orders");
  if (denied) return denied;
  const line = await prisma.supplierOrderLine.findUnique({
    where: { id: String(formData.get("lineId") ?? "") },
    include: { orderItem: { select: { orderId: true, order: { select: { managerId: true } } } } },
  });
  const file = formData.get("file");
  if (!line) return { ok: false, error: "Позиция не найдена" };
  const assignmentDenied = await supplierLinesAssignmentDenied(line.id);
  if (assignmentDenied) return assignmentDenied;
  if (!line.supplierId) return { ok: false, error: "Сначала выберите поставщика в Проценке" };
  if (!(file instanceof File) || !file.size) return { ok: false, error: "Выберите файл" };
  if (file.size > 20 * 1024 * 1024) return { ok: false, error: "Файл больше 20 МБ" };
  let purchaseId = line.purchaseId;
  if (!purchaseId) {
    const linkedOrder = line.orderItem?.orderId
      ? null
      : line.buyerOrderNumber
        ? await prisma.order.findUnique({ where: { orderNumber: line.buyerOrderNumber }, select: { id: true } })
        : null;
    if (line.buyerOrderNumber && !line.orderItem?.orderId && !linkedOrder) {
      return { ok: false, error: `Заказ покупателя № ${line.buyerOrderNumber} не найден` };
    }
    const orderId = line.orderItem?.orderId ?? linkedOrder?.id ?? null;
    const purchase = await prisma.supplierPurchase.create({ data: { supplierId: line.supplierId, orderId } });
    purchaseId = purchase.id;
    // Every line of this supplier and order in «Заказать» goes with it.
    await prisma.supplierOrderLine.updateMany({
      where: {
        supplierId: line.supplierId,
        currency: line.currency,
        purchaseId: null,
        status: "TO_ORDER",
        ...(line.orderItem
          ? { orderItem: { orderId: line.orderItem.orderId } }
          : { orderItem: null, buyerOrderNumber: line.buyerOrderNumber, forStock: line.forStock }),
      },
      data: { purchaseId },
    });
    await prisma.supplierOrderLine.update({ where: { id: line.id }, data: { purchaseId } });
  }
  await addPurchaseFile(purchaseId, "INVOICE", file.name, Buffer.from(await file.arrayBuffer()));
  revalidatePath("/admin/crm/supplier-orders");
  revalidatePath("/admin/warehouse/replenishment");
  return { ok: true, message: "Счёт вложен, позиции — «Требуется оплата»" };
}
