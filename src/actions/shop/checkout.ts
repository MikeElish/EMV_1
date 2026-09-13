"use server";

import { prisma } from "@/lib/prisma";
import { checkoutSchema, type CheckoutInput } from "@/lib/validators/checkout";

export type CheckoutResult =
  | { ok: true; orderNumber: string }
  | { ok: false; error: string };

export async function createOrder(
  input: CheckoutInput
): Promise<CheckoutResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }
  const { customerName, customerPhone, customerEmail, deliveryNote, items } =
    parsed.data;

  const productIds = items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true },
  });

  if (products.length !== new Set(productIds).size) {
    return { ok: false, error: "Часть товаров в корзине больше недоступна" };
  }

  const productById = new Map(products.map((p) => [p.id, p]));

  let totalAmount = 0;
  const orderItemsData = items.map((item) => {
    const product = productById.get(item.productId)!;
    const lineTotal = product.price * item.quantity;
    totalAmount += lineTotal;
    return {
      productId: product.id,
      nameSnapshot: product.name,
      priceSnapshot: product.price,
      quantity: item.quantity,
    };
  });

  const orderNumber = await generateOrderNumber();

  const order = await prisma.order.create({
    data: {
      orderNumber,
      customerName,
      customerPhone,
      customerEmail,
      deliveryNote,
      totalAmount,
      items: { create: orderItemsData },
    },
  });

  return { ok: true, orderNumber: order.orderNumber };
}

async function generateOrderNumber(): Promise<string> {
  const count = await prisma.order.count();
  return `EMV-${String(count + 1).padStart(5, "0")}`;
}
