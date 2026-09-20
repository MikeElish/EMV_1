"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/session";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function cancelMyOrder(orderId: string): Promise<ActionResult> {
  const session = await getAdminSession();
  if (!session?.userId || session.role !== "CUSTOMER") {
    return { ok: false, error: "Требуется вход в аккаунт" };
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.userId !== session.userId) {
    return { ok: false, error: "Заказ не найден" };
  }

  if (order.status !== "AWAITING_PAYMENT") {
    return {
      ok: false,
      error: "Отмена запрещена, направьте запрос на info@emv.one",
    };
  }

  await prisma.order.update({ where: { id: orderId }, data: { status: "CANCELLED" } });
  revalidatePath("/shop/orders");
  revalidatePath("/admin/crm/orders");
  return { ok: true };
}

export async function cancelMyOrderItem(orderItemId: string): Promise<ActionResult> {
  const session = await getAdminSession();
  if (!session?.userId || session.role !== "CUSTOMER") {
    return { ok: false, error: "Требуется вход в аккаунт" };
  }

  const item = await prisma.orderItem.findUnique({
    where: { id: orderItemId },
    include: { order: { include: { items: true } } },
  });
  if (!item || item.order.userId !== session.userId) {
    return { ok: false, error: "Позиция не найдена" };
  }

  if (item.order.status !== "AWAITING_PAYMENT") {
    return {
      ok: false,
      error: "Отмена запрещена, направьте запрос на info@emv.one",
    };
  }

  if (item.cancelled) {
    return { ok: true };
  }

  const remainingItems = item.order.items.filter((i) => i.id !== item.id && !i.cancelled);
  const newTotal = remainingItems.reduce((sum, i) => sum + i.priceSnapshot * i.quantity, 0);
  const allCancelled = remainingItems.length === 0;

  await prisma.$transaction([
    prisma.orderItem.update({ where: { id: orderItemId }, data: { cancelled: true } }),
    prisma.order.update({
      where: { id: item.order.id },
      data: {
        totalAmount: newTotal,
        ...(allCancelled ? { status: "CANCELLED" as const } : {}),
      },
    }),
  ]);

  revalidatePath("/shop/orders");
  revalidatePath("/admin/crm/orders");
  return { ok: true };
}
