import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { DadataError, findPartyByInn } from "@/lib/dadata";

export type SupplierLookup = { ok: true; company: { id: string; name: string; inn: string | null; kpp: string | null }; created: boolean } | { ok: false; error: string };

/** «Контрагент по ИНН»: a company of the site with it, else from ЕГРЮЛ/ЕГРИП as a new Поставщик. */
export async function companyByInn(inn: string): Promise<SupplierLookup> {
  const digits = String(inn).replace(/\D/g, "");
  if (digits.length !== 10 && digits.length !== 12) return { ok: false, error: "ИНН — 10 цифр у организации или 12 у ИП" };
  const select = { id: true, name: true, inn: true, kpp: true } as const;
  const known = await prisma.company.findFirst({ where: { inn: digits, isOwn: false }, select });
  if (known) return { ok: true, company: known, created: false };
  try {
    const party = await findPartyByInn(digits);
    if (!party) return { ok: false, error: "В ЕГРЮЛ/ЕГРИП нет организации с таким ИНН" };
    const company = await prisma.company.create({
      data: { name: party.name, inn: digits, kpp: party.kpp, ogrn: party.ogrn, address: party.address, type: "Поставщик" },
      select,
    });
    revalidatePath("/admin/crm/companies");
    return { ok: true, company, created: true };
  } catch (error) {
    if (error instanceof DadataError) return { ok: false, error: error.message };
    throw error;
  }
}
