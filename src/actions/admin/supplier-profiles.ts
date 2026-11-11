"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { accessDenied, getMyAccess } from "@/lib/access-server";
import { priceWithSupplierLogistics } from "@/lib/supplier-pricing";
import type { ActionResult } from "@/actions/crm/companies";

const PROFILE_LIMIT = 10_000;

async function isSupplier(companyId: string): Promise<boolean> {
  const supplier = await prisma.company.findFirst({
    where: { id: companyId, isOwn: false, type: { contains: "поставщик", mode: "insensitive" } },
    select: { id: true },
  });
  return supplier !== null;
}

export async function getOrCreateProfile(
  companyId: string
): Promise<{ ok: true; profile: { brands: string; categories: string; logisticsMarkupPercent: number } } | { ok: false; error: string }> {
  const denied = await accessDenied("crm.companies", "view");
  if (denied) return denied;
  if (typeof companyId !== "string" || !companyId || companyId.length > 200 || !(await isSupplier(companyId))) {
    return { ok: false, error: "Поставщик не найден" };
  }

  try {
    const profile = await prisma.supplierProfile.upsert({
      where: { companyId },
      update: {},
      create: { companyId },
      select: { brands: true, categories: true, logisticsMarkupPercent: true },
    });
    return { ok: true, profile };
  } catch (error) {
    console.error("[supplier-profiles] load", error);
    return { ok: false, error: "Не удалось загрузить профиль поставщика" };
  }
}

export async function saveSupplierProfile(
  companyId: string,
  brands: string,
  categories: string
): Promise<ActionResult> {
  const denied = await accessDenied("crm.companies");
  if (denied) return denied;
  if (typeof companyId !== "string" || !companyId || companyId.length > 200 || !(await isSupplier(companyId))) {
    return { ok: false, error: "Поставщик не найден" };
  }
  if (typeof brands !== "string" || typeof categories !== "string" ||
      brands.length > PROFILE_LIMIT || categories.length > PROFILE_LIMIT) {
    return { ok: false, error: "Слишком длинный список брендов или категорий" };
  }

  try {
    await prisma.supplierProfile.upsert({
      where: { companyId },
      update: { brands: brands.trim(), categories: categories.trim() },
      create: { companyId, brands: brands.trim(), categories: categories.trim() },
    });
    revalidatePath("/admin/crm/companies");
    return { ok: true };
  } catch (error) {
    console.error("[supplier-profiles] save", error);
    return { ok: false, error: "Не удалось сохранить профиль поставщика" };
  }
}

export async function saveSupplierLogisticsMarkup(
  companyId: string,
  logisticsMarkupPercent: number
): Promise<ActionResult> {
  const me = await getMyAccess();
  if (me?.role !== "OWNER") return { ok: false, error: "Изменять логистическую надбавку может только владелец" };
  if (typeof companyId !== "string" || !companyId || companyId.length > 200 || !(await isSupplier(companyId))) {
    return { ok: false, error: "Поставщик не найден" };
  }
  if (!Number.isFinite(logisticsMarkupPercent) || logisticsMarkupPercent < 0 || logisticsMarkupPercent > 100) {
    return { ok: false, error: "Укажите процент от 0 до 100" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.supplierProfile.upsert({
        where: { companyId },
        update: { logisticsMarkupPercent },
        create: { companyId, logisticsMarkupPercent },
      });
      const lines = await tx.supplierOrderLine.findMany({
        where: { supplierId: companyId, purchaseId: null, currency: "RUB" },
        select: { id: true, quotedPrice: true, price: true },
      });
      for (const line of lines) {
        const basePrice = line.quotedPrice ?? line.price;
        await tx.supplierOrderLine.update({
          where: { id: line.id },
          data: { price: priceWithSupplierLogistics(basePrice, logisticsMarkupPercent), quotedPrice: basePrice },
        });
      }
    });
    revalidatePath("/admin/crm/companies");
    revalidatePath("/admin/crm/supplier-orders");
    return { ok: true };
  } catch (error) {
    console.error("[supplier-profiles] save logistics markup", companyId, error);
    return { ok: false, error: "Не удалось сохранить логистическую надбавку" };
  }
}
