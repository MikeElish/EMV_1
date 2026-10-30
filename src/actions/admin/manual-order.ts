"use server";

import { prisma } from "@/lib/prisma";
import { accessDenied, requireSection } from "@/lib/access-server";
import { getAdminSession } from "@/lib/session";
import { createManualOrderRecord, type ManualOrderResult } from "@/lib/manual-order";
import {
  COMPANY_PRICE_TYPE,
  type ManualOrderRecordInput,
} from "@/lib/validators/manual-order";

export type { ManualOrderResult };

export type ManualOrderFormMode = "crm" | "replenishment";

/** Loaded when the "Новый заказ" window opens, not with the orders page itself. */
export async function getManualOrderFormData(mode: ManualOrderFormMode = "crm") {
  await requireSection(mode === "replenishment" ? "warehouse" : "crm.orders", "view");

  const [customers, companies, products] = await Promise.all([
    mode === "crm"
      ? prisma.user.findMany({
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
        })
      : Promise.resolve([]),
    // Client companies, so a buyer can be found by the company name or ИНН
    // even when nobody from it has an account on the site.
    prisma.company.findMany({
      where: {
        OR: [
          { isOwn: true },
          { isOwn: false, OR: [{ type: null }, { type: { not: "Поставщик" } }] },
        ],
      },
      select: {
        id: true,
        name: true,
        isOwn: true,
        inn: true,
        hasContract: true,
        contract: true,
        priceType: true,
        individualMarkup: true,
        contactName: true,
        contactEmail: true,
        contactPhone: true,
        users: {
          where: { role: "CUSTOMER" },
          select: { lastName: true, firstName: true, patronymic: true, email: true, login: true, phone: true },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
      },
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

  const ownCompany = companies.find((company) => company.isOwn);
  if (mode === "replenishment" && !ownCompany) {
    throw new Error("Не найдена компания EMV для заказа пополнения");
  }

  return {
    customers: (mode === "replenishment" ? [] : customers).map((c) => ({
      id: c.id,
      name: [c.lastName, c.firstName, c.patronymic].filter(Boolean).join(" ") || c.login,
      email: c.email ?? c.login,
      phone: c.phone ?? "",
      companyName: c.company?.name ?? null,
      contract: c.company?.hasContract ? c.company.contract : null,
      priceType: COMPANY_PRICE_TYPE[c.company?.priceType ?? "WHOLESALE"],
      markup: c.company?.individualMarkup ?? null,
    })),
    companies: (mode === "replenishment" ? companies.filter((c) => c.isOwn) : companies).map((c) => {
      const primaryUser = c.users[0];
      return {
        id: c.id,
        name: c.name,
        isOwn: c.isOwn,
        inn: c.inn,
        contract: c.hasContract ? c.contract : null,
        priceType: COMPANY_PRICE_TYPE[c.priceType],
        markup: c.individualMarkup,
        contactName:
          c.contactName ||
          [primaryUser?.lastName, primaryUser?.firstName, primaryUser?.patronymic].filter(Boolean).join(" "),
        contactEmail: c.contactEmail || primaryUser?.email || primaryUser?.login || "",
        contactPhone: c.contactPhone || primaryUser?.phone || "",
      };
    }),
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

export async function createManualOrder(input: ManualOrderRecordInput): Promise<ManualOrderResult> {
  const denied = await accessDenied("crm.orders");
  if (denied) return denied;
  const session = await getAdminSession();
  return createManualOrderRecord(input, session?.userId ?? null);
}

export async function createReplenishmentOrder(input: ManualOrderRecordInput): Promise<ManualOrderResult> {
  const denied = await accessDenied("warehouse");
  if (denied) return denied;
  const ownCompany = await prisma.company.findFirst({
    where: { isOwn: true },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  if (!ownCompany) return { ok: false, error: "Не найдена компания EMV для заказа пополнения" };

  const session = await getAdminSession();
  return createManualOrderRecord(
    {
      ...input,
      customerId: undefined,
      companyId: ownCompany.id,
      customerName: ownCompany.name,
      customerPhone: input.customerPhone ?? "",
      customerEmail: input.customerEmail ?? "",
    },
    session?.userId ?? null
  );
}
