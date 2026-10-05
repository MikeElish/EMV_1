"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-dal";
import { generateOrderNumber } from "@/lib/order-number-db";
import { aggregateOrderStatus, initialLineStatuses, orderMissingFromSuppliers } from "@/lib/order-status";
import { deliveryMethodFromNote } from "@/lib/delivery";
import { manualOrderSchema, type ManualOrderInput } from "@/lib/validators/manual-order";

export type ManualOrderResult = { ok: true; orderNumber: string } | { ok: false; error: string };

/** Loaded when the "Новый заказ" window opens, not with the orders page itself. */
export async function getManualOrderFormData() {
  await verifyAdminSession();

  const [customers, products] = await Promise.all([
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
        company: { select: { name: true, hasContract: true, contract: true } },
      },
      orderBy: { createdAt: "desc" },
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
        pricing: { select: { retailPrice: true, dealerPrice: true } },
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
    })),
    products: products.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      brand: p.brand,
      stock: p.stock,
      isActive: p.isActive,
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
  await verifyAdminSession();

  const parsed = manualOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }
  const { customerId, customerName, customerPhone, customerEmail, deliveryNote, items } = parsed.data;

  let deferred = false;
  if (customerId) {
    const customer = await prisma.user.findUnique({
      where: { id: customerId },
      select: { role: true, company: { select: { paymentType: true } } },
    });
    if (customer?.role !== "CUSTOMER") return { ok: false, error: "Покупатель не найден" };
    deferred = customer.company?.paymentType === "DEFERRED";
  }

  const productIds = [...new Set(items.map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true },
  });
  if (products.length !== productIds.length) {
    return { ok: false, error: "Часть товаров не найдена — обновите окно заказа" };
  }
  const nameById = new Map(products.map((p) => [p.id, p.name]));

  const statuses = await initialLineStatuses(items, deferred);
  const orderNumber = await generateOrderNumber();
  const created = await prisma.order.create({
    data: {
      orderNumber,
      customerName,
      customerPhone,
      customerEmail,
      deliveryNote: deliveryNote || null,
      totalAmount: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      userId: customerId || null,
      deferred,
      status: aggregateOrderStatus(statuses),
      items: {
        create: items.map((i, index) => ({
          productId: i.productId,
          nameSnapshot: nameById.get(i.productId)!,
          priceSnapshot: i.price,
          quantity: i.quantity,
          status: statuses[index],
          deferred,
          deliveryMethod: deliveryMethodFromNote(deliveryNote),
        })),
      },
    },
  });

  await orderMissingFromSuppliers(created.id);
  revalidatePath("/admin/crm/orders");
  revalidatePath("/admin/crm/supplier-orders");
  revalidatePath("/shop/orders");
  return { ok: true, orderNumber };
}
