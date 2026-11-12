"use server";

import { revalidatePath } from "next/cache";
import { addPurchaseFile } from "@/lib/supplier-purchases";
import { prisma } from "@/lib/prisma";
import { supplierInvoiceTokenHash } from "@/lib/supplier-invoice-portal";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ACCEPTED_FILE = /\.(pdf|xlsx?|ods|jpe?g|png|docx?)$/i;

export type SupplierInvoiceResult = { ok: true } | { ok: false; error: string };

export async function submitSupplierInvoice(token: string, formData: FormData): Promise<SupplierInvoiceResult> {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return { ok: false, error: "Ссылка на загрузку счёта недействительна" };
  }
  const purchase = await prisma.supplierPurchase.findUnique({
    where: { invoiceTokenHash: supplierInvoiceTokenHash(token) },
    select: { id: true, invoiceAt: true },
  });
  if (!purchase) return { ok: false, error: "Ссылка на загрузку счёта недействительна" };
  if (purchase.invoiceAt) return { ok: false, error: "Счёт по этому заказу уже получен" };

  const files: File[] = [];
  for (const value of formData.getAll("files")) {
    if (value instanceof File && value.size) files.push(value);
  }
  if (!files.length) return { ok: false, error: "Выберите хотя бы один документ" };

  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) return { ok: false, error: `Файл ${file.name} больше 20 МБ` };
    if (!ACCEPTED_FILE.test(file.name)) return { ok: false, error: `Допустимы PDF, Excel, Word или изображения (${file.name})` };
  }

  for (const [index, file] of files.entries()) {
    const kind: "INVOICE" | "OTHER" = index === 0 ? "INVOICE" : "OTHER";
    await addPurchaseFile(purchase.id, kind, file.name, Buffer.from(await file.arrayBuffer()));
  }

  await prisma.supplierPurchase.update({
    where: { id: purchase.id },
    data: { invoiceTokenHash: null },
  });

  revalidatePath("/admin/crm/supplier-orders");
  revalidatePath("/admin/finance/payment-requests");
  revalidatePath("/admin/warehouse/replenishment");
  return { ok: true };
}
