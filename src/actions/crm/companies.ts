"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-dal";
import { companySchema, type CompanyInput } from "@/lib/validators/crm";
import {
  uploadCompanyDocumentFile,
  deleteCompanyDocumentFile,
} from "@/lib/company-document-storage";

export type ActionResult = { ok: true } | { ok: false; error: string };

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

function toCompanyData(data: CompanyInput) {
  return {
    name: data.name,
    inn: data.inn || null,
    ogrn: data.ogrn || null,
    address: data.address || null,
    hasContract: data.hasContract,
    contract: data.hasContract ? data.contract || null : null,
    type: data.type || null,
    managerId: data.managerId || null,
    paymentType: data.paymentType,
    paymentDeferralDays: data.paymentType === "DEFERRED" ? data.paymentDeferralDays : null,
  };
}

export async function createCompany(input: CompanyInput): Promise<ActionResult> {
  await verifyAdminSession();

  const parsed = companySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  await prisma.company.create({ data: toCompanyData(parsed.data) });
  revalidatePath("/admin/crm/companies");
  redirect("/admin/crm/companies");
}

export async function updateCompany(id: string, input: CompanyInput): Promise<ActionResult> {
  await verifyAdminSession();

  const parsed = companySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  await prisma.company.update({ where: { id }, data: toCompanyData(parsed.data) });
  revalidatePath("/admin/crm/companies");
  return { ok: true };
}

export async function deleteCompany(id: string): Promise<ActionResult> {
  await verifyAdminSession();

  const userCount = await prisma.user.count({ where: { companyId: id } });
  if (userCount > 0) {
    return { ok: false, error: "Нельзя удалить компанию, к которой привязаны пользователи" };
  }

  await prisma.company.delete({ where: { id } });
  revalidatePath("/admin/crm/companies");
  return { ok: true };
}

export async function listCompanyDocuments(companyId: string) {
  await verifyAdminSession();
  return prisma.companyDocument.findMany({
    where: { companyId },
    orderBy: { uploadedAt: "desc" },
  });
}

export async function uploadCompanyDocument(formData: FormData): Promise<ActionResult> {
  await verifyAdminSession();

  const companyId = String(formData.get("companyId") ?? "");
  const file = formData.get("file");

  if (!companyId) return { ok: false, error: "Не указана компания" };
  if (!(file instanceof File)) {
    return { ok: false, error: "Файл не выбран" };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, error: "Файл слишком большой (максимум 20 МБ)" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileUrl = await uploadCompanyDocumentFile(companyId, buffer, file.name);

  await prisma.companyDocument.create({
    data: { companyId, fileName: file.name, fileUrl },
  });

  revalidatePath("/admin/crm/companies");
  return { ok: true };
}

export async function deleteCompanyDocument(id: string): Promise<ActionResult> {
  await verifyAdminSession();

  const doc = await prisma.companyDocument.findUnique({ where: { id } });
  if (!doc) return { ok: false, error: "Файл не найден" };

  await deleteCompanyDocumentFile(doc.fileUrl);
  await prisma.companyDocument.delete({ where: { id } });
  revalidatePath("/admin/crm/companies");
  return { ok: true };
}
