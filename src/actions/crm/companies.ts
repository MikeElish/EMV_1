"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-dal";
import { companySchema, type CompanyInput } from "@/lib/validators/crm";

export type ActionResult = { ok: true } | { ok: false; error: string };

function toCompanyData(data: CompanyInput) {
  return {
    name: data.name,
    inn: data.inn || null,
    ogrn: data.ogrn || null,
    address: data.address || null,
    contract: data.contract || null,
    type: data.type || null,
    managerId: data.managerId || null,
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
