"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/session";
import { setLineStatuses } from "@/lib/order-status";
import { CUSTOMER_CANCELLABLE_STATUSES } from "@/lib/validators/orders";

export type ActionResult = { ok: true } | { ok: false; error: string };

const CANCEL_FORBIDDEN = "Отмена запрещена, направьте запрос на info@emv.one";

export async function cancelMyOrder(orderId: string): Promise<ActionResult> {
  const session = await getAdminSession();
  if (!session?.userId || session.role !== "CUSTOMER") {
    return { ok: false, error: "Требуется вход в аккаунт" };
  }

  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order || order.userId !== session.userId) {
    return { ok: false, error: "Заказ не найден" };
  }

  const active = order.items.filter((i) => i.status !== "CANCELLED");
  if (active.some((i) => !CUSTOMER_CANCELLABLE_STATUSES.includes(i.status))) {
    return { ok: false, error: CANCEL_FORBIDDEN };
  }

  // The customer did it themselves -- no letter about it.
  await setLineStatuses(
    orderId,
    active.map((i) => ({ itemId: i.id, status: "CANCELLED" as const })),
    { notify: false }
  );
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
    include: { order: { select: { userId: true } } },
  });
  if (!item || item.order.userId !== session.userId) {
    return { ok: false, error: "Позиция не найдена" };
  }
  if (item.status === "CANCELLED") return { ok: true };
  if (!CUSTOMER_CANCELLABLE_STATUSES.includes(item.status)) {
    return { ok: false, error: CANCEL_FORBIDDEN };
  }

  await setLineStatuses(item.orderId, [{ itemId: item.id, status: "CANCELLED" }], { notify: false });
  revalidatePath("/shop/orders");
  revalidatePath("/admin/crm/orders");
  return { ok: true };
}
