import "server-only";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/secret-box";
import { tochkaApi } from "@/lib/banks";
import { applyPaymentTerms, refreshOrder } from "@/lib/order-status";
import { checkReceipts, issueReceipt } from "@/lib/cash-receipts";

// Оплата по СБП: a private customer pays the order's lines «Требуется оплата»
// by Точка's payment link (интернет-эквайринг, SBP only). The payment is
// looked up when the customer comes back and every 2 minutes after; APPROVED
// marks those lines paid and the receipt «Предоплата 100%» goes out.

const ACQUIRING = "/acquiring/v1.0";
const LINK_TTL_MIN = 24 * 60;
const SITE = "https://emv.one";

export class SbpError extends Error {}

async function sbpAccount() {
  const settings = await prisma.cashboxSettings.findUnique({ where: { id: 1 } });
  if (!settings?.sbpEnabled) throw new SbpError("Оплата по СБП не подключена");
  const account = settings.bankAccountId ? await prisma.bankAccount.findUnique({ where: { id: settings.bankAccountId } }) : null;
  if (!account?.tokenEnc) throw new SbpError("Для СБП не выбран счёт Точки с токеном");
  return { settings, token: decryptSecret(account.tokenEnc) };
}

/** Настройки → «Проверить СБП»: the Business customerCode and the active retail point of the token. */
export async function setupSbp(bankAccountId: string) {
  const account = await prisma.bankAccount.findUnique({ where: { id: bankAccountId } });
  if (!account?.tokenEnc) throw new SbpError("У счёта нет токена Точки");
  const token = decryptSecret(account.tokenEnc);
  const customers = await tochkaApi<{ Data?: { Customer?: { customerCode: string; customerType: string }[] } }>(token, "/open-banking/v1.0/customers");
  const customerCode = customers.Data?.Customer?.find((c) => c.customerType === "Business")?.customerCode;
  if (!customerCode) throw new SbpError("Точка не вернула код клиента (customerType Business)");
  const retailers = await tochkaApi<{ Data?: { Retailer?: { merchantId?: string; status: string; isActive: boolean; name: string; paymentModes: string[] }[] } }>(
    token,
    `${ACQUIRING}/retailers?customerCode=${customerCode}`
  );
  const retailer = retailers.Data?.Retailer?.find((r) => r.status === "REG" && r.isActive && r.merchantId);
  if (!retailer) throw new SbpError("Интернет-эквайринг не подключён: в Точке нет активной торговой точки (Сервисы → Интернет-эквайринг)");
  await prisma.cashboxSettings.update({ where: { id: 1 }, data: { customerCode, merchantId: retailer.merchantId!, bankAccountId } });
  return { customerCode, merchantId: retailer.merchantId!, name: retailer.name, sbp: retailer.paymentModes.includes("sbp") };
}

/** The lines a private customer can pay now: «Требуется оплата», not paid, with a price. */
export async function payableLines(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { user: { select: { company: { select: { id: true } } } }, items: { where: { status: "AWAITING_PAYMENT", paid: false, cancelled: false, priceSnapshot: { gt: 0 } }, orderBy: { id: "asc" } } },
  });
  if (!order || order.user?.company) return null;
  if (!order.items.length) return null;
  return { lineIds: order.items.map((i) => i.id), amount: order.items.reduce((s, i) => s + i.priceSnapshot * i.quantity, 0) };
}

/** Whether the shop offers СБП now. */
export async function sbpAvailable() {
  const s = await prisma.cashboxSettings.findUnique({ where: { id: 1 }, select: { sbpEnabled: true, merchantId: true } });
  return !!(s?.sbpEnabled && s.merchantId);
}

/** «Оплатить по СБП»: the link of a payment for the lines due (a fresh one of the same lines is reused). */
export async function startSbpPayment(orderId: string): Promise<string> {
  const due = await payableLines(orderId);
  if (!due) throw new SbpError("По заказу сейчас нечего оплачивать");
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, select: { orderNumber: true } });
  const fresh = await prisma.payment.findFirst({
    where: { orderId, status: "PENDING", amount: due.amount, createdAt: { gt: new Date(Date.now() - (LINK_TTL_MIN - 60) * 60_000) } },
    orderBy: { createdAt: "desc" },
  });
  if (fresh?.confirmationUrl && fresh.lineIds.join() === due.lineIds.join()) return fresh.confirmationUrl;

  const { settings, token } = await sbpAccount();
  if (!settings.customerCode || !settings.merchantId) throw new SbpError("СБП не настроена: нажмите «Проверить СБП» в настройках");
  const payment = await prisma.payment.create({ data: { orderId, amount: due.amount, lineIds: due.lineIds } });
  const back = `${SITE}/shop/order/${order.orderNumber}`;
  try {
    const created = await tochkaApi<{ Data: { operationId: string; paymentLink: string } }>(token, `${ACQUIRING}/payments`, {
      method: "POST",
      body: JSON.stringify({
        Data: {
          customerCode: settings.customerCode,
          merchantId: settings.merchantId,
          amount: due.amount / 100,
          purpose: `Оплата заказа № ${order.orderNumber} на emv.one`,
          redirectUrl: `${back}?payment=${payment.id}`,
          failRedirectUrl: `${back}?payment=${payment.id}`,
          paymentMode: ["sbp"],
          ttl: LINK_TTL_MIN,
          paymentLinkId: payment.id,
        },
      }),
    });
    await prisma.payment.update({
      where: { id: payment.id },
      data: { operationId: created.Data.operationId, confirmationUrl: created.Data.paymentLink },
    });
    return created.Data.paymentLink;
  } catch (error) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "CANCELED", rawPayload: { error: (error as Error).message } } });
    throw error;
  }
}

/** Asks Точка about a pending payment; APPROVED pays its lines. Returns its status. */
export async function checkSbpPayment(paymentId: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment?.operationId || payment.status !== "PENDING") return payment?.status ?? null;
  const { token } = await sbpAccount();
  const info = await tochkaApi<{ Data: { Operation: { status: string; amount: number; paidAt?: string }[] } }>(
    token,
    `${ACQUIRING}/payments/${encodeURIComponent(payment.operationId)}`
  );
  const op = info.Data.Operation[0];
  if (!op) return payment.status;
  if (op.status === "APPROVED") {
    // Taken once: only the call that moves it from PENDING settles it.
    const claimed = await prisma.payment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: { status: "SUCCEEDED", paidAt: op.paidAt ? new Date(op.paidAt) : new Date(), rawPayload: op as object },
    });
    if (claimed.count) await settle(payment.id);
    return "SUCCEEDED";
  }
  if (op.status === "EXPIRED") {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "CANCELED", rawPayload: op as object } });
    return "CANCELED";
  }
  return payment.status;
}

async function settle(paymentId: string) {
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  await prisma.orderItem.updateMany({ where: { id: { in: payment.lineIds }, paid: false }, data: { paid: true } });
  await refreshOrder(prisma, payment.orderId);
  await applyPaymentTerms(payment.orderId);
  await issueReceipt(payment.orderId, "PREPAYMENT", payment.lineIds, payment.id).catch((e) => console.error("[receipts]", e));
}

/** Pending payments of the last 2 days and the receipts waiting for АТОЛ. */
async function pollPayments() {
  const pending = await prisma.payment.findMany({
    where: { status: "PENDING", operationId: { not: null }, createdAt: { gt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) } },
    select: { id: true },
  });
  for (const p of pending) await checkSbpPayment(p.id).catch((e) => console.error("[sbp]", p.id, (e as Error).message));
  await checkReceipts().catch((e) => console.error("[receipts]", (e as Error).message));
}

const timer = globalThis as unknown as { __emvSbpTimer?: NodeJS.Timeout };

export function startSbpTimer() {
  if (timer.__emvSbpTimer) return;
  timer.__emvSbpTimer = setInterval(() => void pollPayments(), 2 * 60 * 1000);
}
