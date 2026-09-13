"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-dal";
import { OrderStatus } from "@prisma/client";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function updateOrderStatus(
  id: string,
  status: OrderStatus
): Promise<ActionResult> {
  await verifyAdminSession();

  if (!Object.values(OrderStatus).includes(status)) {
    return { ok: false, error: "Некорректный статус" };
  }

  await prisma.order.update({ where: { id }, data: { status } });
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  return { ok: true };
}
