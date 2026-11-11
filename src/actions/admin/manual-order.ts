"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { accessDenied, requireSection } from "@/lib/access-server";
import { getAdminSession } from "@/lib/session";
import { createManualOrderRecord, type ManualOrderResult } from "@/lib/manual-order";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import {
  COMPANY_PRICE_TYPE,
  type ManualOrderRecordInput,
} from "@/lib/validators/manual-order";

export type { ManualOrderResult };

export type ManualOrderFormMode = "crm" | "replenishment";

/** Loaded when the "Новый заказ" window opens, not with the orders page itself. */
export async function getManualOrderFormData(mode: ManualOrderFormMode = "crm") {
  await requireSection(mode === "replenishment" ? "warehouse.replenishment" : "crm.orders", "view");

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
        pendingRegistration: true,
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
  const offers = await prisma.supplierOffer.findMany({
    where: {
      productId: { in: mode === "crm" ? products.map((product) => product.id) : [] },
      supplierId: { not: null },
      noOffer: false,
      price: { gt: 0 },
      supplier: { is: { isOwn: false } },
    },
    select: {
      id: true,
      productId: true,
      price: true,
      quotedPrice: true,
      currency: true,
      deliveryDays: true,
      selected: true,
      supplier: { select: { name: true } },
    },
    orderBy: [{ selected: "desc" }, { priceUpdatedAt: "desc" }],
  });
  const offersByProduct = new Map<string, typeof offers>();
  for (const offer of offers) {
    offersByProduct.set(offer.productId, [...(offersByProduct.get(offer.productId) ?? []), offer]);
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
      pendingRegistration: p.pendingRegistration,
      // For «Индивидуальный»: the company's markup over it.
      purchase: p.pricing?.purchasePrice ?? 0,
      prices: {
        retail: p.pricing?.retailPrice ?? p.price,
        wholesale: p.price,
        dealer: p.pricing?.dealerPrice ?? p.price,
      },
      supplierOffers: offersByProduct.get(p.id) ?? [],
    })),
  };
}

export type ManualOrderFormData = Awaited<ReturnType<typeof getManualOrderFormData>>;

export type PendingProductResult =
  | { ok: true; product: ManualOrderFormData["products"][number] }
  | { ok: false; error: string };

export async function registerPendingProduct(rawSku: string): Promise<PendingProductResult> {
  const denied = await accessDenied("crm.orders");
  if (denied) return denied;
  const sku = String(rawSku ?? "").trim();
  if (!sku || sku.length > 64) return { ok: false, error: "Артикул должен содержать от 1 до 64 символов" };

  const existing = await prisma.product.findFirst({
    where: { sku: { equals: sku, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return { ok: false, error: "Товар с таким артикулом уже есть — обновите список и выберите его" };

  const category = await prisma.category.findFirst({
    where: { isActive: true },
    select: { id: true },
    orderBy: { name: "asc" },
  }) ?? await prisma.category.upsert({
    where: { slug: "pending-registration" },
    create: { name: "Регистрация номенклатуры", slug: "pending-registration", isActive: false },
    update: {},
    select: { id: true },
  });

  try {
    const product = await prisma.product.create({
      data: {
        sku,
        name: "Регистрация номенклатуры",
        slug: `registration-${randomUUID()}`,
        price: 0,
        stock: 0,
        images: [],
        categoryId: category.id,
        isActive: false,
        pendingRegistration: true,
      },
      select: {
        id: true,
        sku: true,
        name: true,
        brand: true,
        stock: true,
        isActive: true,
        pendingRegistration: true,
        price: true,
        pricing: { select: { purchasePrice: true, retailPrice: true, dealerPrice: true } },
      },
    });
    const result = {
      id: product.id,
      sku: product.sku,
      name: product.name,
      brand: product.brand,
      stock: product.stock,
      isActive: product.isActive,
      pendingRegistration: product.pendingRegistration,
      purchase: product.pricing?.purchasePrice ?? 0,
      prices: {
        retail: product.pricing?.retailPrice ?? product.price,
        wholesale: product.price,
        dealer: product.pricing?.dealerPrice ?? product.price,
      },
      supplierOffers: [],
    };
    revalidatePath("/admin/crm/products");
    revalidatePath("/admin/crm/orders");
    return { ok: true, product: result };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "Товар с таким артикулом уже добавлен — обновите список и выберите его" };
    }
    throw error;
  }
}

export async function createManualOrder(input: ManualOrderRecordInput): Promise<ManualOrderResult> {
  const denied = await accessDenied("crm.orders");
  if (denied) return denied;
  const session = await getAdminSession();
  return createManualOrderRecord(input, session?.userId ?? null);
}

export async function createReplenishmentOrder(input: ManualOrderRecordInput): Promise<ManualOrderResult> {
  const denied = await accessDenied("warehouse.replenishment");
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
