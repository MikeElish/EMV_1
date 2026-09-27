import "server-only";
import { prisma } from "@/lib/prisma";
import { formatOrderNumber, getMoscowDayRangeUtc } from "@/lib/order-number";

export async function generateOrderNumber(): Promise<string> {
  const now = new Date();
  const { start, end } = getMoscowDayRangeUtc(now);
  const countToday = await prisma.order.count({
    where: { createdAt: { gte: start, lt: end } },
  });
  return formatOrderNumber(now, countToday + 1);
}
