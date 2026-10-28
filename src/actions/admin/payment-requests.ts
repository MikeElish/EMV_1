"use server";

import path from "path";
import { unlink } from "fs/promises";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { accessDenied, requireSection } from "@/lib/access-server";
import { companyByInn, type SupplierLookup } from "@/lib/company-by-inn";
import { markRequestPaid, matchRequest, paymentsFor, storeRequestFile, syncExtraCostRequest } from "@/lib/payment-requests";
import { PAYMENT_REQUEST_STATUSES, type PaymentRequestInput } from "@/lib/validators/payment-requests";

export type ActionResult = { ok: true } | { ok: false; error: string };

const SECTION = "finance.payment-requests";
const MAX_FILE_SIZE = 20 * 1024 * 1024;

function revalidate() {
  revalidatePath("/admin/finance/payment-requests");
  revalidatePath("/admin/crm/supplier-orders");
  revalidatePath("/admin/crm/extra-costs");
}

/** Loaded when the card opens: companies and orders. */
export async function getPaymentRequestFormData() {
  await requireSection(SECTION, "view");
  const [companies, orders] = await Promise.all([
    prisma.company.findMany({ where: { isOwn: false }, select: { id: true, name: true, inn: true, kpp: true }, orderBy: { name: "asc" } }),
    prisma.order.findMany({ select: { id: true, orderNumber: true, customerName: true }, orderBy: { createdAt: "desc" }, take: 1000 }),
  ]);
  return { companies, orders };
}
export type PaymentRequestFormData = Awaited<ReturnType<typeof getPaymentRequestFormData>>;

export async function paymentRequestCompanyByInn(inn: string): Promise<SupplierLookup> {
  const denied = await accessDenied(SECTION);
  if (denied) return denied;
  return companyByInn(inn);
}

/** The card's «Сохранить» (JSON in `data`) with, optionally, the invoice file. */
export async function savePaymentRequest(formData: FormData): Promise<ActionResult> {
  const denied = await accessDenied(SECTION);
  if (denied) return denied;
  let input: PaymentRequestInput;
  try {
    input = JSON.parse(String(formData.get("data") ?? ""));
  } catch {
    return { ok: false, error: "Некорректные данные" };
  }
  const amount = Math.round(Number(input.amount));
  if (!(amount > 0)) return { ok: false, error: "Укажите сумму" };
  if (!input.companyId) return { ok: false, error: "Выберите контрагента" };
  const company = await prisma.company.findUnique({ where: { id: input.companyId }, select: { inn: true } });
  if (!company) return { ok: false, error: "Контрагент не найден" };
  const file = formData.get("file");
  if (file instanceof File && file.size > MAX_FILE_SIZE) return { ok: false, error: "Файл больше 20 МБ" };

  const data = {
    companyId: input.companyId,
    inn: company.inn,
    orderId: input.orderId || null,
    amount,
    purpose: String(input.purpose ?? "").trim().slice(0, 500) || null,
  };
  const saved = input.id
    ? await prisma.paymentRequest.update({ where: { id: input.id }, data })
    : await prisma.paymentRequest.create({ data });
  if (file instanceof File && file.size > 0) await storeRequestFile(saved.id, "INVOICE", file.name, Buffer.from(await file.arrayBuffer()));
  await matchRequest(saved.id);
  revalidate();
  return { ok: true };
}

/** «Оплачено» by hand closes it as a payment would; back to «Требуется оплата» unlinks the payment. */
export async function setPaymentRequestStatus(id: string, status: string): Promise<ActionResult> {
  const denied = await accessDenied(SECTION);
  if (denied) return denied;
  if (!(PAYMENT_REQUEST_STATUSES as readonly string[]).includes(status)) return { ok: false, error: "Некорректный статус" };
  const request = await prisma.paymentRequest.findUnique({ where: { id: String(id) } });
  if (!request) return { ok: false, error: "Заявка не найдена" };
  if (status === "Оплачено") await markRequestPaid(request.id);
  else {
    await prisma.paymentRequest.update({
      where: { id: request.id },
      data: { status, ...(status === "Требуется оплата" ? { paidAt: null, bankTransactionId: null } : {}) },
    });
    if (request.extraCostId) {
      await prisma.extraCost.update({ where: { id: request.extraCostId }, data: { status } });
      await syncExtraCostRequest(request.extraCostId);
    }
  }
  revalidate();
  return { ok: true };
}

/** Outgoing payments of the statements to this payee not tied to a request. */
export async function listRequestPayments(id: string) {
  await requireSection(SECTION, "view");
  return (await paymentsFor(String(id))).map((t) => ({ ...t, date: t.date.toISOString() }));
}

/** «Связать» in the card: this payment closes the request. */
export async function linkRequestPayment(id: string, transactionId: string): Promise<ActionResult> {
  const denied = await accessDenied(SECTION);
  if (denied) return denied;
  const [request, tx] = await Promise.all([
    prisma.paymentRequest.findUnique({ where: { id: String(id) } }),
    prisma.bankTransaction.findUnique({ where: { id: String(transactionId) }, include: { bankAccount: { select: { name: true } }, paymentRequest: { select: { id: true } } } }),
  ]);
  if (!request || !tx || tx.incoming) return { ok: false, error: "Заявка или платёж не найдены" };
  if (tx.paymentRequest) return { ok: false, error: "Этот платёж уже закрыл другую заявку" };
  await markRequestPaid(request.id, tx);
  await prisma.bankTransaction.update({ where: { id: tx.id }, data: { matchNote: `Заявка на оплату № ${request.number} оплачена (вручную)` } });
  revalidate();
  revalidatePath("/admin/settings/banks");
  return { ok: true };
}

export async function uploadPaymentRequestFile(formData: FormData): Promise<ActionResult> {
  const denied = await accessDenied(SECTION);
  if (denied) return denied;
  const id = String(formData.get("id") ?? "");
  const kind = formData.get("kind") === "PAYMENT" ? "PAYMENT" : formData.get("kind") === "INVOICE" ? "INVOICE" : "OTHER";
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) return { ok: false, error: "Выберите файл" };
  if (file.size > MAX_FILE_SIZE) return { ok: false, error: "Файл больше 20 МБ" };
  if (!(await prisma.paymentRequest.findUnique({ where: { id }, select: { id: true } }))) return { ok: false, error: "Заявка не найдена" };
  await storeRequestFile(id, kind, file.name, Buffer.from(await file.arrayBuffer()));
  revalidate();
  return { ok: true };
}

/** Only one added by hand: a supplier's invoice or an extra cost is cancelled instead. */
export async function deletePaymentRequest(id: string): Promise<ActionResult> {
  const denied = await accessDenied(SECTION);
  if (denied) return denied;
  const request = await prisma.paymentRequest.findUnique({ where: { id: String(id) }, include: { files: true } });
  if (!request) return { ok: true };
  if (request.purchaseId || request.extraCostId) return { ok: false, error: "Заявка из заказа поставщику или доп.расхода — поставьте «Отменено»" };
  await prisma.paymentRequest.delete({ where: { id: request.id } });
  for (const f of request.files) {
    if (f.fileUrl.startsWith("/uploads/payment-requests/")) await unlink(path.join(process.cwd(), "public", f.fileUrl)).catch(() => {});
  }
  revalidate();
  return { ok: true };
}
