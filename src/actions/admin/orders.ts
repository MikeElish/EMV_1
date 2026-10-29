"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { accessDenied, ownerOnly, requireSection } from "@/lib/access-server";
import { OrderStatus, OrderDocumentCategory, DeliveryMethod } from "@prisma/client";
import {
  uploadOrderDocumentFile,
  deleteOrderDocumentFile,
} from "@/lib/order-document-storage";
import { applyPaymentTerms, refreshOrder, releaseAwaitingSupply, setLineStatuses, targetLines } from "@/lib/order-status";
import { sendDeliveryChangeLetter } from "@/lib/order-notifications";
import { issueOrderInvoice } from "@/lib/order-invoice";
import { applyOrderSurcharges } from "@/lib/order-surcharge";

export type ActionResult = { ok: true } | { ok: false; error: string };

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

function revalidateOrders() {
  revalidatePath("/admin/crm/orders");
  revalidatePath("/admin/crm/products");
  revalidatePath("/shop/orders");
  revalidatePath("/admin/crm/supplier-orders");
  revalidatePath("/admin/crm/price-check");
}

/** Status of one line, or (scope "order") of every line of its order that isn't cancelled. */
export async function updateOrderItemStatus(
  itemId: string,
  status: OrderStatus,
  scope: "item" | "order" = "item"
): Promise<ActionResult> {
  const denied = await accessDenied("crm.orders");
  if (denied) return denied;

  if (!Object.values(OrderStatus).includes(status)) {
    return { ok: false, error: "Некорректный статус" };
  }
  const target = await targetLines(itemId, scope);
  if (!target) return { ok: false, error: "Позиция не найдена" };
  await setLineStatuses(
    target.orderId,
    target.ids.map((id) => ({ itemId: id, status })),
    { notify: true }
  );
  // A cancelled line «Под заказ» changes what the others share.
  if (status === "CANCELLED") await applyOrderSurcharges(target.orderId);
  revalidateOrders();
  return { ok: true };
}

export type PaymentState = "paid" | "unpaid" | "deferred";
export type LineScope = "item" | "order";

/** Оплачено / Не оплачено / Отсрочка of one line, or (scope "order") of every active line. */
export async function updateLinePayment(
  itemId: string,
  state: PaymentState,
  scope: LineScope = "item"
): Promise<ActionResult> {
  const denied = await accessDenied("crm.orders");
  if (denied) return denied;
  if (!["paid", "unpaid", "deferred"].includes(state)) return { ok: false, error: "Некорректный статус оплаты" };
  const target = await targetLines(itemId, scope);
  if (!target) return { ok: false, error: "Позиция не найдена" };

  await prisma.orderItem.updateMany({
    where: { id: { in: target.ids } },
    data: state === "paid" ? { paid: true } : { paid: false, deferred: state === "deferred" },
  });
  await refreshOrder(prisma, target.orderId);
  await applyPaymentTerms(target.orderId);
  revalidateOrders();
  return { ok: true };
}

/**
 * The price of a line ordered «По запросу» (or any line not paid yet): the
 * order total follows. Price in kopecks, without the surcharge of the lines
 * «Под заказ» -- that is counted again on top.
 */
export async function updateLinePrice(itemId: string, price: number): Promise<ActionResult> {
  const denied = await accessDenied("crm.orders");
  if (denied) return denied;
  if (!Number.isInteger(price) || price <= 0 || price > 1_000_000_000) return { ok: false, error: "Укажите цену больше нуля" };
  const item = await prisma.orderItem.findUnique({ where: { id: itemId }, select: { orderId: true, paid: true } });
  if (!item) return { ok: false, error: "Позиция не найдена" };
  // The owner corrects any line («Ручное редактирование»); others only unpaid ones.
  if (item.paid && (await ownerOnly())) return { ok: false, error: "Позиция уже оплачена — цену не меняем" };
  await prisma.orderItem.update({ where: { id: itemId }, data: { priceSnapshot: price, surcharge: 0 } });
  await refreshOrder(prisma, item.orderId);
  await applyOrderSurcharges(item.orderId);
  revalidateOrders();
  return { ok: true };
}
/** «Ручное редактирование» (owner): change the quantity of one line. */
export async function updateLineQuantity(itemId: string, quantity: number): Promise<ActionResult> {
  const denied = await accessDenied("crm.orders");
  if (denied) return denied;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000) return { ok: false, error: "Укажите количество" };

  const item = await prisma.orderItem.findUnique({
    where: { id: itemId },
    select: { orderId: true, productId: true, quantity: true, stockWrittenOff: true, paid: true },
  });
  if (!item) return { ok: false, error: "Позиция не найдена" };
  if (item.paid && (await ownerOnly())) return { ok: false, error: "Позиция уже оплачена — количество не меняем" };

  const delta = quantity - item.quantity;
  await prisma.$transaction(async (tx) => {
    if (item.stockWrittenOff && delta !== 0) {
      await tx.product.update({
        where: { id: item.productId },
        data: delta > 0 ? { stock: { decrement: delta } } : { stock: { increment: -delta } },
      });
    }
    await tx.orderItem.update({ where: { id: itemId }, data: { quantity } });
    await refreshOrder(tx, item.orderId);
  });
  await applyOrderSurcharges(item.orderId);
  revalidateOrders();
  return { ok: true };
}

/** «Ручное редактирование» (owner): add an extra product to an existing order. */
export async function addOrderItem(
  orderId: string,
  productId: string,
  quantity: number,
  price: number
): Promise<ActionResult> {
  const denied = await accessDenied("crm.orders");
  if (denied) return denied;
  if (await ownerOnly()) return { ok: false, error: "Добавлять товар в заказ может только владелец" };
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000) return { ok: false, error: "Укажите количество" };
  if (!Number.isInteger(price) || price <= 0 || price > 1_000_000_000) return { ok: false, error: "Укажите цену" };

  const [order, product] = await Promise.all([
    prisma.order.findUnique({ where: { id: orderId }, select: { deferred: true, items: { select: { deliveryMethod: true }, take: 1 } } }),
    prisma.product.findUnique({ where: { id: productId }, select: { name: true } }),
  ]);
  if (!order) return { ok: false, error: "Заказ не найден" };
  if (!product) return { ok: false, error: "Товар не найден" };

  const { initialLineStatuses } = await import("@/lib/order-status");
  const [status] = await initialLineStatuses([{ productId, quantity }], order.deferred);
  const deliveryMethod = order.items[0]?.deliveryMethod ?? null;

  await prisma.orderItem.create({
    data: {
      orderId,
      productId,
      nameSnapshot: product.name,
      priceSnapshot: price,
      quantity,
      status,
      deferred: order.deferred,
      deliveryMethod,
    },
  });
  await refreshOrder(prisma, orderId);
  await applyOrderSurcharges(orderId);
  revalidateOrders();
  return { ok: true };
}



export async function updateLineDeliveryDate(
  itemId: string,
  deliveryDate: string | null,
  scope: LineScope = "item"
): Promise<ActionResult> {
  const denied = await accessDenied("crm.orders");
  if (denied) return denied;
  const target = await targetLines(itemId, scope);
  if (!target) return { ok: false, error: "Позиция не найдена" };
  await prisma.orderItem.updateMany({
    where: { id: { in: target.ids } },
    data: { deliveryDate: deliveryDate ? new Date(deliveryDate) : null },
  });
  await refreshOrder(prisma, target.orderId);
  revalidateOrders();
  return { ok: true };
}

/**
 * Delivery type changed in CRM: the customer has to confirm it (letter +
 * «Требуется подтверждение» in Мои заказы). Setting it back to what the
 * customer had chosen withdraws the request.
 */
export async function updateLineDelivery(
  itemId: string,
  method: DeliveryMethod,
  scope: LineScope = "item"
): Promise<ActionResult> {
  const denied = await accessDenied("crm.orders");
  if (denied) return denied;
  if (!Object.values(DeliveryMethod).includes(method)) return { ok: false, error: "Некорректный тип доставки" };
  const target = await targetLines(itemId, scope);
  if (!target) return { ok: false, error: "Позиция не найдена" };

  const lines = await prisma.orderItem.findMany({ where: { id: { in: target.ids } } });
  const asked: string[] = [];
  for (const line of lines) {
    if (line.deliveryMethod === method) continue;
    // What the customer chose stays the reference until they answer.
    const chosen = line.deliveryConfirmPending ? line.deliveryPrevMethod : line.deliveryMethod;
    const back = chosen === method;
    await prisma.orderItem.update({
      where: { id: line.id },
      data: {
        deliveryMethod: method,
        deliveryPrevMethod: back ? null : chosen,
        deliveryConfirmPending: !back,
      },
    });
    if (!back) asked.push(line.id);
  }
  if (asked.length) {
    sendDeliveryChangeLetter(target.orderId, asked).catch((error) =>
      console.error("[orders] delivery change letter failed", target.orderId, error)
    );
  }
  revalidateOrders();
  return { ok: true };
}

export async function cancelOrderAsStaff(id: string): Promise<ActionResult> {
  const denied = await accessDenied("crm.orders");
  if (denied) return denied;
  const items = await prisma.orderItem.findMany({ where: { orderId: id }, select: { id: true } });
  await setLineStatuses(
    id,
    items.map((i) => ({ itemId: i.id, status: "CANCELLED" as const })),
    { notify: true }
  );
  revalidateOrders();
  return { ok: true };
}

export async function listOrderDocuments(orderId: string, category: OrderDocumentCategory) {
  await requireSection("crm.orders", "view");
  return prisma.orderDocument.findMany({
    where: { orderId, category },
    orderBy: { uploadedAt: "desc" },
  });
}

export async function uploadOrderDocument(formData: FormData): Promise<ActionResult> {
  const denied = await accessDenied("crm.orders");
  if (denied) return denied;

  const orderId = String(formData.get("orderId") ?? "");
  const category = String(formData.get("category") ?? "");
  const file = formData.get("file");

  if (!orderId) return { ok: false, error: "Не указан заказ" };
  if (!Object.values(OrderDocumentCategory).includes(category as OrderDocumentCategory)) {
    return { ok: false, error: "Некорректная категория" };
  }
  if (!(file instanceof File)) {
    return { ok: false, error: "Файл не выбран" };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, error: "Файл слишком большой (максимум 20 МБ)" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileUrl = await uploadOrderDocumentFile(orderId, category, buffer, file.name);

  await prisma.orderDocument.create({
    data: { orderId, category: category as OrderDocumentCategory, fileName: file.name, fileUrl },
  });

  revalidatePath("/admin/crm/orders");
  return { ok: true };
}

/** «Сформировать счёт»: the invoice is written to 1С and its PDF goes into «Счета». */
export async function issueInvoice(orderId: string): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const denied = await accessDenied("crm.orders");
  if (denied) return denied;
  try {
    const issued = await issueOrderInvoice(String(orderId));
    return { ok: true, message: `Счёт № ${issued.number} записан в 1С и вложен в заказ` };
  } catch (error) {
    console.error("[invoice]", error);
    return { ok: false, error: error instanceof Error ? error.message : "Не удалось сформировать счёт" };
  }
}

export async function deleteOrderDocument(id: string): Promise<ActionResult> {
  const denied = await accessDenied("crm.orders");
  if (denied) return denied;

  const doc = await prisma.orderDocument.findUnique({ where: { id } });
  if (!doc) return { ok: false, error: "Файл не найден" };

  await deleteOrderDocumentFile(doc.fileUrl);
  await prisma.orderDocument.delete({ where: { id } });
  revalidatePath("/admin/crm/orders");
  return { ok: true };
}

// ---- Deleting (owner only) -------------------------------------------------------------

/** Supplier order lines not yet ordered go with the customer line they were for. */
const UNORDERED_SUPPLIER_STATUSES = ["TO_CHECK", "REQUESTED", "CHECKED", "TO_ORDER"] as const;

/**
 * Removes order lines as if they had never been there: shipped goods go back
 * on stock, unordered supplier lines and the order's files go too.
 */
async function removeLines(orderId: string, itemIds: string[] | "all") {
  const items = await prisma.orderItem.findMany({
    where: { orderId, ...(itemIds === "all" ? {} : { id: { in: itemIds } }) },
    select: { id: true, productId: true, quantity: true, stockWrittenOff: true },
  });
  const ids = items.map((i) => i.id);
  const remaining = itemIds === "all" ? 0 : await prisma.orderItem.count({ where: { orderId, id: { notIn: ids } } });
  const wholeOrder = remaining === 0;
  const docs = wholeOrder ? await prisma.orderDocument.findMany({ where: { orderId }, select: { fileUrl: true } }) : [];

  await prisma.$transaction(async (tx) => {
    for (const i of items) {
      if (i.stockWrittenOff) await tx.product.update({ where: { id: i.productId }, data: { stock: { increment: i.quantity } } });
    }
    await tx.supplierOrderLine.deleteMany({ where: { orderItemId: { in: ids }, status: { in: [...UNORDERED_SUPPLIER_STATUSES] } } });
    if (wholeOrder) {
      await tx.payment.deleteMany({ where: { orderId } });
      await tx.order.delete({ where: { id: orderId } });
    } else {
      await tx.orderItem.deleteMany({ where: { id: { in: ids } } });
      await refreshOrder(tx, orderId);
    }
  });
  await Promise.all(docs.map((d) => deleteOrderDocumentFile(d.fileUrl)));
  // Stock that came back (or reserves let go) may serve lines waiting for supply.
  await releaseAwaitingSupply([...new Set(items.map((i) => i.productId))]);
  revalidateOrders();
}

/** Владелец: the whole order. */
export async function deleteOrderAsOwner(orderId: string): Promise<ActionResult> {
  const denied = await ownerOnly();
  if (denied) return denied;
  if (!(await prisma.order.findUnique({ where: { id: orderId }, select: { id: true } }))) {
    return { ok: false, error: "Заказ не найден" };
  }
  await removeLines(orderId, "all");
  return { ok: true };
}

/** Владелец: one line; the last one takes the order with it. */
export async function deleteOrderLineAsOwner(itemId: string): Promise<ActionResult> {
  const denied = await ownerOnly();
  if (denied) return denied;
  const item = await prisma.orderItem.findUnique({ where: { id: itemId }, select: { orderId: true } });
  if (!item) return { ok: false, error: "Позиция не найдена" };
  await removeLines(item.orderId, [itemId]);
  return { ok: true };
}

/** «Менеджер» of an order -- whose sale it is in Отчёты → Бонусы. */
export async function updateOrderManager(orderId: string, managerId: string | null): Promise<ActionResult> {
  const denied = await accessDenied("crm.orders");
  if (denied) return denied;
  if (managerId) {
    const employee = await prisma.user.findUnique({ where: { id: managerId }, select: { role: true } });
    if (!employee || employee.role === "CUSTOMER" || employee.role === "DRIVER") return { ok: false, error: "Сотрудник не найден" };
  }
  await prisma.order.update({ where: { id: orderId }, data: { managerId } });
  revalidatePath("/admin/crm/orders");
  revalidatePath("/admin/reports/bonuses");
  return { ok: true };
}
