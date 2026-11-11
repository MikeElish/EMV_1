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
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) return { ok: false, error: "Выберите файл счёта" };
  if (file.size > MAX_FILE_SIZE) return { ok: false, error: "Файл больше 20 МБ" };
  if (!ACCEPTED_FILE.test(file.name)) return { ok: false, error: "Допустимы PDF, Excel, Word или изображения" };

  await addPurchaseFile(purchase.id, "INVOICE", file.name, Buffer.from(await file.arrayBuffer()));
  await prisma.supplierPurchase.update({
    where: { id: purchase.id },
    data: { invoiceTokenHash: null },
  });
  revalidatePath("/admin/crm/supplier-orders");
  revalidatePath("/admin/finance/payment-requests");
  return { ok: true };
}
