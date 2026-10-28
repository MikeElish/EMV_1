import "server-only";
import { prisma } from "@/lib/prisma";
import { atolReport, atolSell, type AtolItem } from "@/lib/atol";

// Чеки (54-ФЗ) of the online payments of private customers, by АТОЛ Онлайн:
//  - PREPAYMENT, «Предоплата 100%», when an СБП payment comes (src/lib/sbp.ts);
//  - FULL_PAYMENT, «Полный расчёт» with the advance offset, when those lines
//    are handed over (Склад → Выдача).
// An advance is taxed at the calculated rate (22/122 …), the full settlement
// at the goods' own.

const CALCULATED: Record<string, string> = { vat22: "vat122", vat20: "vat120", vat10: "vat110", vat5: "vat105", vat7: "vat107" };

export type ReceiptKind = "PREPAYMENT" | "FULL_PAYMENT";

const rub = (kopecks: number) => Math.round(kopecks) / 100;

/** Writes the receipt of these lines and sends it; an error stays in the receipt («Повторить»). */
export async function issueReceipt(orderId: string, kind: ReceiptKind, lineIds: string[], paymentId: string | null = null) {
  const settings = await prisma.cashboxSettings.findUnique({ where: { id: 1 } });
  if (!settings?.receiptsEnabled) return null;
  const lines = await prisma.orderItem.findMany({ where: { id: { in: lineIds }, orderId }, orderBy: { id: "asc" } });
  if (!lines.length) return null;
  const amount = lines.reduce((s, l) => s + l.priceSnapshot * l.quantity, 0);
  const receipt = await prisma.cashReceipt.create({ data: { orderId, paymentId, kind, lineIds: lines.map((l) => l.id), amount } });
  await sendReceipt(receipt.id);
  return receipt.id;
}

/** (Re)sends a receipt not done yet; АТОЛ keeps one document per external_id, so a repeat is safe. */
export async function sendReceipt(receiptId: string) {
  const receipt = await prisma.cashReceipt.findUniqueOrThrow({ where: { id: receiptId }, include: { order: { select: { customerEmail: true, customerPhone: true } } } });
  if (receipt.status === "done") return;
  const settings = await prisma.cashboxSettings.findUniqueOrThrow({ where: { id: 1 } });
  const lines = await prisma.orderItem.findMany({ where: { id: { in: receipt.lineIds } }, orderBy: { id: "asc" } });
  const prepayment = receipt.kind === "PREPAYMENT";
  const vat = prepayment ? (CALCULATED[settings.vat] ?? settings.vat) : settings.vat;
  const items: AtolItem[] = lines.map((l) => ({
    name: l.nameSnapshot.slice(0, 128),
    price: rub(l.priceSnapshot),
    quantity: l.quantity,
    sum: rub(l.priceSnapshot * l.quantity),
    payment_method: prepayment ? "full_prepayment" : "full_payment",
    vat: { type: vat },
  }));
  const total = rub(receipt.amount);
  const phone = receipt.order.customerPhone.replace(/\D/g, "").replace(/^8/, "7");
  try {
    const uuid = await atolSell(settings, receipt.id, {
      client: receipt.order.customerEmail ? { email: receipt.order.customerEmail } : { phone: `+${phone}` },
      company: { email: settings.email, sno: settings.sno, inn: settings.inn, payment_address: settings.paymentAddress },
      items,
      payments: [{ type: prepayment ? 1 : 2, sum: total }],
      total,
    });
    await prisma.cashReceipt.update({ where: { id: receipt.id }, data: { atolUuid: uuid, status: "wait", error: null } });
  } catch (error) {
    await prisma.cashReceipt.update({ where: { id: receipt.id }, data: { status: "fail", error: (error as Error).message } });
  }
}

/** Receipts sent and not answered yet: their fiscal data or error. */
export async function checkReceipts() {
  const waiting = await prisma.cashReceipt.findMany({ where: { status: "wait", atolUuid: { not: null } }, take: 50 });
  if (!waiting.length) return;
  const settings = await prisma.cashboxSettings.findUniqueOrThrow({ where: { id: 1 } });
  for (const r of waiting) {
    const report = await atolReport(settings, r.atolUuid!).catch((e) => ({ status: "wait" as const, error: (e as Error).message }));
    if (report.status === "wait") continue;
    await prisma.cashReceipt.update({
      where: { id: r.id },
      data: report.status === "done" ? { status: "done", fiscal: (report.payload ?? {}) as object, error: null } : { status: "fail", error: report.error ?? "АТОЛ Онлайн не пробил чек" },
    });
  }
}

/**
 * Выдача: the handed-over lines paid in advance by a receipt get «Полный
 * расчёт» -- once each.
 */
export async function settleHandedOver(orderId: string, lineIds: string[]) {
  const receipts = await prisma.cashReceipt.findMany({ where: { orderId, status: { not: "fail" } }, select: { kind: true, lineIds: true } });
  const prepaid = new Set(receipts.filter((r) => r.kind === "PREPAYMENT").flatMap((r) => r.lineIds));
  const settled = new Set(receipts.filter((r) => r.kind === "FULL_PAYMENT").flatMap((r) => r.lineIds));
  const due = lineIds.filter((id) => prepaid.has(id) && !settled.has(id));
  if (due.length) await issueReceipt(orderId, "FULL_PAYMENT", due);
}
