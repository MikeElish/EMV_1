"use server";

import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/session";
import { SHIPPED_STATUSES } from "@/lib/validators/orders";

/**
 * The signed-in customer's «Баланс» for the shop header: what is paid less
 * what is shipped, kopecks -- over its company's orders (as in CRM →
 * Компании), or its own when it has none. Above 0 -- paid in advance, below
 * -- owed. Null for a guest or staff.
 */
export async function getMyBalance(): Promise<number | null> {
  const session = await getAdminSession();
  if (!session?.userId || session.role !== "CUSTOMER") return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { companyId: true } });
  if (!user) return null;
  const lines = await prisma.orderItem.findMany({
    where: {
      status: { not: "CANCELLED" },
      order: user.companyId ? { user: { companyId: user.companyId } } : { userId: session.userId },
    },
    select: { status: true, paid: true, priceSnapshot: true, quantity: true },
  });
  let balance = 0;
  for (const l of lines) {
    const sum = l.priceSnapshot * l.quantity;
    if (l.paid) balance += sum;
    if (SHIPPED_STATUSES.includes(l.status)) balance -= sum;
  }
  return balance;
}
