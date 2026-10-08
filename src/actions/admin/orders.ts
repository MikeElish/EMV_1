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
