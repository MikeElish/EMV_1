"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-dal";
import { OrderStatus, OrderDocumentCategory } from "@prisma/client";
import {
  uploadOrderDocumentFile,
  deleteOrderDocumentFile,
} from "@/lib/order-document-storage";
import { applyPaymentTerms, setLineStatuses } from "@/lib/order-status";

export type ActionResult = { ok: true } | { ok: false; error: string };

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

function revalidateOrders() {
  revalidatePath("/admin/crm/orders");
  revalidatePath("/admin/crm/products");
  revalidatePath("/shop/orders");
}

/** Status of one line, or (scope "order") of every line of its order that isn't cancelled. */
export async function updateOrderItemStatus(
  itemId: string,
  status: OrderStatus,
  scope: "item" | "order" = "item"
): Promise<ActionResult> {
  await verifyAdminSession();

  if (!Object.values(OrderStatus).includes(status)) {
    return { ok: false, error: "Некорректный статус" };
  }
  const item = await prisma.orderItem.findUnique({
    where: { id: itemId },
    select: { id: true, orderId: true, order: { select: { items: { select: { id: true, status: true } } } } },
  });
  if (!item) return { ok: false, error: "Позиция не найдена" };

  const targets =
    scope === "order"
      ? item.order.items.filter((i) => i.id === item.id || i.status !== "CANCELLED").map((i) => i.id)
      : [item.id];
  await setLineStatuses(
    item.orderId,
    targets.map((id) => ({ itemId: id, status })),
    { notify: true }
  );
  revalidateOrders();
  return { ok: true };
}

export type PaymentState = "paid" | "unpaid" | "deferred";

export async function updatePaymentState(id: string, state: PaymentState): Promise<ActionResult> {
  await verifyAdminSession();
  if (!["paid", "unpaid", "deferred"].includes(state)) return { ok: false, error: "Некорректный статус оплаты" };

  await prisma.order.update({
    where: { id },
    data:
      state === "paid"
        ? { paid: true }
        : { paid: false, deferred: state === "deferred" },
  });
  await applyPaymentTerms(id);
  revalidateOrders();
  return { ok: true };
}

export async function updateDeliveryDate(
  id: string,
  deliveryDate: string | null
): Promise<ActionResult> {
  await verifyAdminSession();
  await prisma.order.update({
    where: { id },
    data: { deliveryDate: deliveryDate ? new Date(deliveryDate) : null },
  });
  revalidatePath("/admin/crm/orders");
  return { ok: true };
}

export async function cancelOrderAsStaff(id: string): Promise<ActionResult> {
  await verifyAdminSession();
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
  await verifyAdminSession();
  return prisma.orderDocument.findMany({
    where: { orderId, category },
    orderBy: { uploadedAt: "desc" },
  });
}

export async function uploadOrderDocument(formData: FormData): Promise<ActionResult> {
  await verifyAdminSession();

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
  await verifyAdminSession();

  const doc = await prisma.orderDocument.findUnique({ where: { id } });
  if (!doc) return { ok: false, error: "Файл не найден" };

  await deleteOrderDocumentFile(doc.fileUrl);
  await prisma.orderDocument.delete({ where: { id } });
  revalidatePath("/admin/crm/orders");
  return { ok: true };
}
