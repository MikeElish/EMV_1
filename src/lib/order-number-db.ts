import "server-only";
import { prisma } from "@/lib/prisma";
import { formatOrderNumber, formatOrderDatePrefix, getMoscowDayRangeUtc } from "@/lib/order-number";

export async function generateOrderNumber(): Promise<string> {
  const now = new Date();
  const { start, end } = getMoscowDayRangeUtc(now);
  const prefix = formatOrderDatePrefix(now);
  const existing = await prisma.order.findMany({
    where: { createdAt: { gte: start, lt: end } },
    select: { orderNumber: true },
  });
  let maxSequence = 0;
  for (const { orderNumber } of existing) {
    if (!orderNumber.startsWith(prefix + "/")) continue;
    const seq = Number(orderNumber.slice(prefix.length + 1));
    if (Number.isFinite(seq) && seq > maxSequence) maxSequence = seq;
  }
  return formatOrderNumber(now, maxSequence + 1);
}
