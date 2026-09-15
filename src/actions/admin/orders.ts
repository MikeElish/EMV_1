"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-dal";
import { OrderStatus, OrderDocumentCategory } from "@prisma/client";
import {
  uploadOrderDocumentFile,
  deleteOrderDocumentFile,
} from "@/lib/order-document-storage";

export type ActionResult = { ok: true } | { ok: false; error: string };

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export async function updateOrderStatus(
  id: string,
  status: OrderStatus
): Promise<ActionResult> {
  await verifyAdminSession();

  if (!Object.values(OrderStatus).includes(status)) {
    return { ok: false, error: "Некорректный статус" };
  }

  await prisma.order.update({ where: { id }, data: { status } });
  revalidatePath("/admin/crm/orders");
  return { ok: true };
}

export async function updatePaid(id: string, paid: boolean): Promise<ActionResult> {
  await verifyAdminSession();
  await prisma.order.update({ where: { id }, data: { paid } });
  revalidatePath("/admin/crm/orders");
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
  await prisma.order.update({ where: { id }, data: { status: "CANCELLED" } });
  revalidatePath("/admin/crm/orders");
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
