import "server-only";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import PDFDocument from "pdfkit";
import type { BankTransaction } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { SELLER } from "@/lib/invoice-pdf";
import { rublesInWords } from "@/lib/money-words";

// Финансы → Заявки на оплату. A supplier's invoice (Заказ поставщику) or an
// extra cost in «Требуется оплата» becomes a request; one can be added by
// hand. An outgoing payment of a statement to the payee's ИНН for the
// request's sum (or the sum of all its open ones) closes it: «Оплачено», the
// payment order into its files and the supplier order's, the supplier lines
// «Заказано», the extra cost «Оплачено».

const DAY = 24 * 60 * 60 * 1000;
// The bank may round; a payment within a rouble is the same sum.
const SAME_SUM = 100;
const FILES_DIR = path.join(process.cwd(), "public", "uploads", "payment-requests");
const FONT = path.join(process.cwd(), "assets", "fonts", "PTSans-Regular.ttf");
const FONT_BOLD = path.join(process.cwd(), "assets", "fonts", "PTSans-Bold.ttf");

function refresh() {
  for (const p of ["/admin/finance/payment-requests", "/admin/crm/supplier-orders", "/admin/crm/extra-costs"]) {
    try {
      revalidatePath(p);
    } catch {
      // not in a request
    }
  }
}

export async function storeRequestFile(requestId: string, kind: "INVOICE" | "PAYMENT" | "OTHER", name: string, content: Buffer) {
  const dir = path.join(FILES_DIR, requestId);
  await mkdir(dir, { recursive: true });
  const stored = `${Date.now()}-${crypto.randomUUID()}${path.extname(name)}`;
  await writeFile(path.join(dir, stored), content);
  return prisma.paymentRequestFile.create({ data: { requestId, kind, fileName: name, fileUrl: `/uploads/payment-requests/${requestId}/${stored}` } });
}

/** The supplier's invoice came: the request for its supplier order (its sum -- of the lines), with the file. */
export async function requestForPurchase(purchaseId: string, invoice?: { fileName: string; fileUrl: string }) {
  const purchase = await prisma.supplierPurchase.findUniqueOrThrow({ where: { id: purchaseId }, include: { lines: true, supplier: { select: { inn: true } } } });
  const amount = purchase.lines.reduce((s, l) => s + l.price * l.quantity, 0);
  const existing = await prisma.paymentRequest.findUnique({ where: { purchaseId } });
  const request =
    existing ??
    (await prisma.paymentRequest.create({
      data: {
        purchaseId,
        companyId: purchase.supplierId,
        inn: purchase.supplier.inn,
        orderId: purchase.orderId,
        amount,
        purpose: `Счёт по заказу поставщику № ${purchase.number}`,
      },
    }));
  if (existing && existing.status === "Требуется оплата" && existing.amount !== amount) {
    await prisma.paymentRequest.update({ where: { id: existing.id }, data: { amount } });
  }
  if (invoice) await prisma.paymentRequestFile.create({ data: { requestId: request.id, kind: "INVOICE", ...invoice } });
  await matchRequest(request.id);
  refresh();
}

/** An extra cost saved: in «Требуется оплата» it has a request; «Оплачено» / «Отменено» carry over. */
export async function syncExtraCostRequest(extraCostId: string) {
  const cost = await prisma.extraCost.findUnique({ where: { id: extraCostId }, include: { supplier: { select: { inn: true } } } });
  if (!cost) return;
  const existing = await prisma.paymentRequest.findUnique({ where: { extraCostId } });
  if (cost.status !== "Требуется оплата") {
    if (existing && existing.status !== cost.status) {
      await prisma.paymentRequest.update({ where: { id: existing.id }, data: { status: cost.status, paidAt: cost.status === "Оплачено" ? existing.paidAt ?? new Date() : existing.paidAt } });
    }
    refresh();
    return;
  }
  const data = {
    companyId: cost.supplierId,
    inn: cost.supplier?.inn ?? null,
    orderId: cost.orderId,
    amount: cost.amount,
    purpose: [cost.kind, cost.number && `№ ${cost.number}`].filter(Boolean).join(" "),
    status: "Требуется оплата",
  };
  const request = existing
    ? await prisma.paymentRequest.update({ where: { id: existing.id }, data })
    : await prisma.paymentRequest.create({ data: { ...data, extraCostId } });
  // The cost's file is the request's invoice.
  if (cost.fileUrl) {
    await prisma.paymentRequestFile.deleteMany({ where: { requestId: request.id, kind: "INVOICE", fileUrl: { startsWith: "/uploads/extra-costs/" } } });
    await prisma.paymentRequestFile.create({ data: { requestId: request.id, kind: "INVOICE", fileName: cost.fileName ?? "Счёт", fileUrl: cost.fileUrl } });
  }
  await matchRequest(request.id);
  refresh();
}

const money = (kopecks: number) => (kopecks / 100).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/ /g, " ");

/** «Платёжное поручение» as the statement gives it -- the payment's file of the request. */
function renderPaymentPdf(tx: BankTransaction, bank: string): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margins: { top: 40, bottom: 40, left: 50, right: 40 } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
  doc.registerFont("r", FONT);
  doc.registerFont("b", FONT_BOLD);
  const date = tx.date.toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" });
  doc.font("b").fontSize(14).text(`Платёжное поручение${tx.documentNumber ? ` № ${tx.documentNumber}` : ""} от ${date}`);
  doc.moveDown(0.3).font("r").fontSize(9).fillColor("#666").text(`Сведения из выписки банка: ${bank}`).fillColor("black");
  doc.moveDown(1);
  const row = (label: string, value: string) => {
    doc.font("b").fontSize(10).text(label, { continued: true }).font("r").text(`  ${value}`);
    doc.moveDown(0.4);
  };
  row("Плательщик:", `${SELLER.name}, ИНН ${SELLER.inn}`);
  row("Получатель:", [tx.counterpartyName, tx.counterpartyInn && `ИНН ${tx.counterpartyInn}`].filter(Boolean).join(", ") || "—");
  row("Сумма:", `${money(tx.amount)} ₽ (${rublesInWords(tx.amount)})`);
  row("Назначение платежа:", tx.purpose ?? "—");
  row("Дата списания:", date);
  doc.end();
  return done;
}

/**
 * Closes a request: by a payment of a statement (`tx`), or by hand. The
 * supplier order's lines become «Заказано», the extra cost «Оплачено».
 */
export async function markRequestPaid(requestId: string, tx?: BankTransaction & { bankAccount?: { name: string } }) {
  const request = await prisma.paymentRequest.update({
    where: { id: requestId },
    data: { status: "Оплачено", paidAt: tx?.date ?? new Date(), ...(tx ? { bankTransactionId: tx.id } : {}) },
  });
  if (tx) {
    const name = `Платёжное поручение${tx.documentNumber ? ` № ${tx.documentNumber}` : ""} от ${tx.date.toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" })}.pdf`;
    const bank = tx.bankAccount?.name ?? (await prisma.bankAccount.findUnique({ where: { id: tx.bankAccountId }, select: { name: true } }))?.name ?? "";
    const file = await storeRequestFile(request.id, "PAYMENT", name, await renderPaymentPdf(tx, bank));
    if (request.purchaseId) {
      await prisma.supplierPurchaseFile.create({ data: { purchaseId: request.purchaseId, kind: "PAYMENT", fileName: file.fileName, fileUrl: file.fileUrl } });
    }
  }
  if (request.purchaseId) {
    await prisma.supplierOrderLine.updateMany({ where: { purchaseId: request.purchaseId, status: { in: ["TO_ORDER", "AWAITING_PAYMENT"] } }, data: { status: "ORDERED" } });
  }
  if (request.extraCostId) await prisma.extraCost.update({ where: { id: request.extraCostId }, data: { status: "Оплачено" } });
  refresh();
  return request;
}

const OPEN = { status: "Требуется оплата", bankTransactionId: null } as const;

const innOf = (r: { inn: string | null; company: { inn: string | null } | null }) => r.company?.inn || r.inn;

/**
 * An outgoing payment of a statement: the open requests to the payee's ИНН --
 * the one of its sum, or all of them when it pays them together. Returns the note.
 */
export async function matchOutgoing(tx: BankTransaction): Promise<string | null> {
  if (!tx.counterpartyInn) return null;
  const open = await prisma.paymentRequest.findMany({
    where: { ...OPEN, OR: [{ inn: tx.counterpartyInn }, { company: { inn: tx.counterpartyInn } }] },
    include: { company: { select: { inn: true } } },
    orderBy: { createdAt: "asc" },
  });
  if (!open.length) return null;
  const same = open.filter((r) => Math.abs(r.amount - tx.amount) < SAME_SUM);
  let paid = same.length === 1 ? same : [];
  if (!paid.length && open.length > 1 && Math.abs(open.reduce((s, r) => s + r.amount, 0) - tx.amount) < SAME_SUM) paid = open;
  if (!paid.length) {
    return same.length
      ? `Подходит ${same.length} заявки на оплату по сумме — свяжите вручную`
      : `Заявки на оплату этому получателю есть (${open.map((r) => `№ ${r.number}`).join(", ")}), сумма не совпала — проверьте вручную`;
  }
  // One payment closes several: the first keeps the link, the rest are paid by it too.
  for (const [i, r] of paid.entries()) {
    if (i === 0) await markRequestPaid(r.id, tx);
    else await markRequestPaid(r.id).then(() => prisma.paymentRequest.update({ where: { id: r.id }, data: { paidAt: tx.date } }));
  }
  return `Заявк${paid.length > 1 ? "и" : "а"} на оплату ${paid.map((r) => `№ ${r.number}`).join(", ")} оплачен${paid.length > 1 ? "ы" : "а"}`;
}

/** A new request: an outgoing payment already in a statement (since a month before) may be it. */
export async function matchRequest(requestId: string) {
  const request = await prisma.paymentRequest.findUnique({ where: { id: requestId }, include: { company: { select: { inn: true } } } });
  if (!request || request.status !== "Требуется оплата" || request.bankTransactionId) return;
  const inn = innOf(request);
  if (!inn) return;
  const candidates = await prisma.bankTransaction.findMany({
    where: {
      incoming: false,
      counterpartyInn: inn,
      paymentRequest: null,
      amount: { gt: request.amount - SAME_SUM, lt: request.amount + SAME_SUM },
      date: { gte: new Date(request.createdAt.getTime() - 30 * DAY) },
    },
    include: { bankAccount: { select: { name: true } } },
  });
  if (candidates.length !== 1) return;
  await markRequestPaid(request.id, candidates[0]);
  await prisma.bankTransaction.update({ where: { id: candidates[0].id }, data: { matchNote: `Заявка на оплату № ${request.number} оплачена` } });
}

/** Unlinked outgoing payments to the request's payee -- offered in its card. */
export async function paymentsFor(requestId: string) {
  const request = await prisma.paymentRequest.findUnique({ where: { id: requestId }, include: { company: { select: { inn: true } } } });
  const inn = request && innOf(request);
  if (!inn) return [];
  return prisma.bankTransaction.findMany({
    where: { incoming: false, counterpartyInn: inn, paymentRequest: null, date: { gte: new Date(Date.now() - 180 * DAY) } },
    orderBy: { date: "desc" },
    take: 30,
    select: { id: true, date: true, amount: true, documentNumber: true, purpose: true },
  });
}
