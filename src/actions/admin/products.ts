"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, type OrderStatus } from "@prisma/client";
import { RESERVE_STATUSES } from "@/lib/validators/orders";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-dal";
import { releaseAwaitingSupply } from "@/lib/order-status";
import { selectOffer } from "@/lib/supplier-offers";
import { productSchema, type ProductInput } from "@/lib/validators/product";
import { buildProductSlug } from "@/lib/slug";

export type ActionResult = { ok: true } | { ok: false; error: string };

function toProductData(data: ProductInput) {
  const attributes: Prisma.InputJsonObject = {
    ...(data.machineType ? { machineType: data.machineType } : {}),
    ...(data.compatibleWith.length > 0
      ? { compatibleWith: data.compatibleWith }
      : {}),
  };

  return {
    sku: data.sku,
    name: data.name,
    slug: buildProductSlug(data.brand, data.sku),
    description: data.description,
    price: data.price,
    stock: data.stock,
    categoryId: data.categoryId,
    brand: data.brand,
    images: data.images,
    isActive: data.isActive,
    attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
  };
}

function firstOffer(data: ProductInput) {
  return {
    supplierId: data.supplierId || null,
    price: data.purchasePrice,
    deliveryDays: data.deliveryDays ?? null,
    quality: data.quality || null,
    selected: true,
  };
}

function toPricingData(data: ProductInput) {
  return {
    purchasePrice: data.purchasePrice,
    retailPrice: data.retailPrice,
    dealerPrice: data.dealerPrice,
    supplierId: data.supplierId || null,
  };
}

export async function createProduct(input: ProductInput): Promise<ActionResult> {
  await verifyAdminSession();

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  if (!parsed.data.supplierId) {
    return { ok: false, error: "Укажите поставщика (вкладка «Цены»)" };
  }
  if (parsed.data.purchasePrice <= 0) {
    return { ok: false, error: "Укажите закупочную цену (вкладка «Цены»)" };
  }

  const slug = buildProductSlug(parsed.data.brand, parsed.data.sku);
  const existing = await prisma.product.findFirst({
    where: { OR: [{ sku: parsed.data.sku }, { slug }] },
  });
  if (existing) {
    return { ok: false, error: "Товар с таким артикулом уже существует" };
  }

  await prisma.product.create({
    data: {
      ...toProductData(parsed.data),
      pricing: { create: toPricingData(parsed.data) },
      offers: { create: firstOffer(parsed.data) },
    },
  });

  revalidatePath("/admin/crm/products");
  revalidatePath("/shop");
  revalidatePath("/shop/cart");
  redirect("/admin/crm/products");
}

export async function updateProduct(
  id: string,
  input: ProductInput
): Promise<ActionResult> {
  await verifyAdminSession();

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  // With supplier offers, the purchase price is the selected offer's -- not
  // whatever the form sent.
  const offers = await prisma.supplierOffer.findMany({ where: { productId: id } });
  const chosen =
    offers.find((o) => o.id === parsed.data.selectedOfferId) ?? offers.find((o) => o.selected) ?? offers[0];
  if (chosen) {
    parsed.data.purchasePrice = chosen.price;
    parsed.data.supplierId = chosen.supplierId ?? undefined;
  }

  if (parsed.data.isActive && (parsed.data.purchasePrice <= 0 || parsed.data.price <= 0)) {
    return { ok: false, error: "Чтобы товар был активен, укажите закупочную и оптовую цену (вкладка «Цены»)" };
  }

  const slug = buildProductSlug(parsed.data.brand, parsed.data.sku);
  const conflict = await prisma.product.findFirst({
    where: {
      OR: [{ sku: parsed.data.sku }, { slug }],
      NOT: { id },
    },
  });
  if (conflict) {
    return { ok: false, error: "Товар с таким артикулом уже существует" };
  }

  const current = await prisma.product.findUnique({ where: { id }, select: { stock: true } });
  const restocked = current !== null && parsed.data.stock > current.stock;

  await prisma.product.update({
    where: { id },
    data: {
      ...toProductData(parsed.data),
      ...(restocked ? { newArrivalAt: new Date() } : {}),
      pricing: {
        upsert: { create: toPricingData(parsed.data), update: toPricingData(parsed.data) },
      },
    },
  });
  if (chosen && !chosen.selected) await selectOffer(prisma, id, chosen.id);
  if (!chosen && (parsed.data.supplierId || parsed.data.purchasePrice > 0)) {
    await prisma.supplierOffer.create({ data: { productId: id, ...firstOffer(parsed.data) } });
  }
  if (restocked) await releaseAwaitingSupply([id]);

  revalidatePath("/admin/crm/products");
  revalidatePath("/admin/crm/orders");
  revalidatePath("/shop");
  revalidatePath("/shop/cart");
  redirect("/admin/crm/products");
}

export async function toggleProductActive(
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  await verifyAdminSession();
  if (isActive) {
    // Products imported from 1С arrive with price 0 -- they must not go on sale for free.
    const product = await prisma.product.findUnique({
      where: { id },
      select: { price: true, category: { select: { name: true, isActive: true } } },
    });
    if (!product || product.price <= 0) {
      return { ok: false, error: "Сначала укажите цены в карточке товара" };
    }
    if (!product.category.isActive) {
      return { ok: false, error: `Категория «${product.category.name}» скрыта с сайта — сначала включите её` };
    }
  }
  await prisma.product.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/crm/products");
  revalidatePath("/shop");
  revalidatePath("/shop/cart");
  return { ok: true };
}

export type ProductDocumentLine = {
  orderNumber: string;
  status: OrderStatus;
  quantity: number;
  date: Date;
};

/** Customer orders holding this product in reserve (CRM → Товары, "Резерв"). */
export async function listProductReserve(productId: string): Promise<ProductDocumentLine[]> {
  await verifyAdminSession();
  const lines = await prisma.orderItem.findMany({
    where: { productId, status: { in: RESERVE_STATUSES } },
    select: { quantity: true, status: true, order: { select: { orderNumber: true, createdAt: true } } },
    orderBy: { order: { createdAt: "asc" } },
  });
  return lines.map((l) => ({
    orderNumber: l.order.orderNumber,
    status: l.status,
    quantity: l.quantity,
    date: l.order.createdAt,
  }));
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  await verifyAdminSession();

  const orderItemCount = await prisma.orderItem.count({ where: { productId: id } });
  if (orderItemCount > 0) {
    return {
      ok: false,
      error: "Нельзя удалить товар, по которому есть заказы. Деактивируйте его вместо удаления.",
    };
  }

  await prisma.product.delete({ where: { id } });
  revalidatePath("/admin/crm/products");
  revalidatePath("/shop");
  revalidatePath("/shop/cart");
  return { ok: true };
}
