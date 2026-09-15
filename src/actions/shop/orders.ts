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
  return { ok: true };
}
