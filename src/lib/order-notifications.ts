import { prisma } from "@/lib/prisma";
import { sendSiteMail } from "@/lib/mailer";
import { ORDER_STATUS_LABELS } from "@/lib/validators/orders";

// Letters to the customer when order lines change status:
// - all (not cancelled) lines now share one status -> "Статус вашего заказа
//   изменён" right away;
// - otherwise the changed lines are flagged and one "Статус данных позиций
//   изменён" letter per order goes out at the next 5-minute mark (:00, :05 …).

const SITE_URL = (process.env.SITE_URL ?? "https://emv.one").replace(/\/+$/, "");
const DIGEST_PERIOD_MS = 5 * 60 * 1000;

function myOrdersUrl(orderNumber: string) {
  return `${SITE_URL}/shop/orders?orderNumber=${encodeURIComponent(orderNumber)}`;
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

async function recipientOf(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { orderNumber: true, customerEmail: true, user: { select: { email: true } } },
  });
  if (!order) return null;
  const to = order.customerEmail || order.user?.email;
  return to ? { to, orderNumber: order.orderNumber } : null;
}

function letter(orderNumber: string, lines: string[]) {
  const url = myOrdersUrl(orderNumber);
  return {
    subject: `Заказ ${orderNumber}`,
    text: `${lines.join("\n")}\n\nМои заказы: ${url}`,
    html:
      lines.map((l) => `<p style="margin:0 0 8px">${escapeHtml(l)}</p>`).join("") +
      `<p style="margin:16px 0 0"><a href="${escapeHtml(url)}">Открыть «Мои заказы»</a></p>`,
  };
}

export async function sendOrderStatusLetter(orderId: string, status: keyof typeof ORDER_STATUS_LABELS) {
  const recipient = await recipientOf(orderId);
  if (!recipient) return;
  await sendSiteMail({
    to: recipient.to,
    ...letter(recipient.orderNumber, [
      "Статус вашего заказа изменён.",
      `Текущий статус «${ORDER_STATUS_LABELS[status]}»`,
    ]),
  });
}

/** Called after lines of an order changed status (see setLineStatuses). */
export async function noticeLineStatusChanges(orderId: string, changedItemIds: string[]) {
  const items = await prisma.orderItem.findMany({ where: { orderId }, select: { status: true } });
  const active = items.filter((i) => i.status !== "CANCELLED");
  const common = active.length ? active[0].status : "CANCELLED";

  if (active.every((i) => i.status === common)) {
    // The whole order letter covers anything still waiting for the digest.
    await prisma.orderItem.updateMany({ where: { orderId, statusNotifyPending: true }, data: { statusNotifyPending: false } });
    // Not awaited: the employee's click shouldn't wait for the SMTP server.
    sendOrderStatusLetter(orderId, common).catch((error) =>
      console.error("[order-notifications] status letter failed", orderId, error)
    );
    return;
  }

  await prisma.orderItem.updateMany({
    where: { id: { in: changedItemIds } },
    data: { statusNotifyPending: true },
  });
}

/** Sends one "Статус данных позиций изменён" letter per order with flagged lines. */
export async function flushLineStatusDigests() {
  const pending = await prisma.orderItem.findMany({
    where: { statusNotifyPending: true },
    select: { id: true, orderId: true },
  });
  const byOrder = new Map<string, string[]>();
  for (const p of pending) byOrder.set(p.orderId, [...(byOrder.get(p.orderId) ?? []), p.id]);

  for (const [orderId, ids] of byOrder) {
    // Claim first, so a second process (or an overlapping run) can't send it too.
    const claimed = await prisma.orderItem.updateMany({
      where: { id: { in: ids }, statusNotifyPending: true },
      data: { statusNotifyPending: false },
    });
    if (!claimed.count) continue;

    try {
      const recipient = await recipientOf(orderId);
      if (!recipient) continue;
      const lines = await prisma.orderItem.findMany({
        where: { id: { in: ids } },
        select: { nameSnapshot: true, quantity: true, status: true, product: { select: { sku: true } } },
        orderBy: { id: "asc" },
      });
      await sendSiteMail({
        to: recipient.to,
        ...letter(recipient.orderNumber, [
          "Статус данных позиций изменён:",
          ...lines.map(
            (l) =>
              `${l.nameSnapshot}${l.product?.sku ? ` (арт. ${l.product.sku})` : ""}, ${l.quantity} шт. — ${ORDER_STATUS_LABELS[l.status]}`
          ),
        ]),
      });
    } catch (error) {
      console.error("[order-notifications] digest failed, will retry", orderId, error);
      await prisma.orderItem.updateMany({ where: { id: { in: ids } }, data: { statusNotifyPending: true } });
    }
  }
}

const timerState = globalThis as unknown as { orderDigestTimer?: ReturnType<typeof setTimeout> };

/** Runs flushLineStatusDigests at every 5-minute mark of the hour. Started from src/instrumentation.ts. */
export function startLineStatusDigestTimer() {
  if (timerState.orderDigestTimer) return;
  const schedule = () => {
    const wait = DIGEST_PERIOD_MS - (Date.now() % DIGEST_PERIOD_MS) + 1000;
    timerState.orderDigestTimer = setTimeout(async () => {
      try {
        await flushLineStatusDigests();
      } catch (error) {
        console.error("[order-notifications] digest run failed", error);
      }
      schedule();
    }, wait);
  };
  schedule();
}
