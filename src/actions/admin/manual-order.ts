"use server";

import { prisma } from "@/lib/prisma";
import { accessDenied, requireSection } from "@/lib/access-server";
import { createManualOrderRecord, type ManualOrderResult } from "@/lib/manual-order";
import { COMPANY_PRICE_TYPE, type ManualOrderInput } from "@/lib/validators/manual-order";

export type { ManualOrderResult };

/** Loaded when the "Новый заказ" window opens, not with the orders page itself. */
export async function getManualOrderFormData() {
  await requireSection("crm.orders", "view");

  const [customers, companies, products] = await Promise.all([
    prisma.user.findMany({
      where: { role: "CUSTOMER" },
      select: {
        id: true,
        lastName: true,
        firstName: true,
        patronymic: true,
        email: true,
        login: true,
        phone: true,
        company: { select: { name: true, hasContract: true, contract: true, priceType: true, individualMarkup: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    // Client companies, so a buyer can be found by the company name or ИНН
    // even when nobody from it has an account on the site.
    prisma.company.findMany({
      where: { isOwn: false, OR: [{ type: null }, { type: { not: "Поставщик" } }] },
      select: { id: true, name: true, inn: true, hasContract: true, contract: true, priceType: true, individualMarkup: true },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      select: {
        id: true,
        sku: true,
        name: true,
        brand: true,
        stock: true,
        isActive: true,
        price: true,
        pricing: { select: { purchasePrice: true, retailPrice: true, dealerPrice: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    customers: customers.map((c) => ({
      id: c.id,
      name: [c.lastName, c.firstName, c.patronymic].filter(Boolean).join(" ") || c.login,
      email: c.email ?? c.login,
      phone: c.phone ?? "",
      companyName: c.company?.name ?? null,
      contract: c.company?.hasContract ? c.company.contract : null,
      priceType: COMPANY_PRICE_TYPE[c.company?.priceType ?? "WHOLESALE"],
      markup: c.company?.individualMarkup ?? null,
    })),
    companies: companies.map((c) => ({
      id: c.id,
      name: c.name,
      inn: c.inn,
      contract: c.hasContract ? c.contract : null,
      priceType: COMPANY_PRICE_TYPE[c.priceType],
      markup: c.individualMarkup,
    })),
    products: products.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      brand: p.brand,
      stock: p.stock,
      isActive: p.isActive,
      // For «Индивидуальный»: the company's markup over it.
      purchase: p.pricing?.purchasePrice ?? 0,
      prices: {
        retail: p.pricing?.retailPrice ?? p.price,
        wholesale: p.price,
        dealer: p.pricing?.dealerPrice ?? p.price,
      },
    })),
  };
}

export type ManualOrderFormData = Awaited<ReturnType<typeof getManualOrderFormData>>;

export async function createManualOrder(input: ManualOrderInput): Promise<ManualOrderResult> {
  const denied = await accessDenied("crm.orders");
  if (denied) return denied;
  return createManualOrderRecord(input);
}
