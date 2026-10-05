"use server";

import { prisma } from "@/lib/prisma";
import { checkoutSchema, type CheckoutInput } from "@/lib/validators/checkout";
import { getAdminSession } from "@/lib/session";
import { generateOrderNumber } from "@/lib/order-number-db";
import { needsEmailVerification } from "@/lib/email-verification";
import { aggregateOrderStatus, initialLineStatuses, orderMissingFromSuppliers } from "@/lib/order-status";
import { getShopOffers } from "@/lib/supplier-offers";
import { deliveryMethodFromNote } from "@/lib/delivery";

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
  // A picked supplier offer is charged at its own site price -- worked out
  // here, never taken from the browser.
  const offers = await getShopOffers(items.filter((i) => i.offerId).map((i) => i.productId));

  let totalAmount = 0;
  const orderItemsData: {
    productId: string;
    nameSnapshot: string;
    priceSnapshot: number;
    quantity: number;
    offerId?: string;
  }[] = [];
  for (const item of items) {
    const product = productById.get(item.productId)!;
    let price = product.price;
    let offerId: string | undefined;
    if (item.offerId) {
      const offer = offers[item.productId]?.find((o) => o.id === item.offerId);
      if (!offer) return { ok: false, error: `Предложение по «${product.name}» изменилось — обновите корзину` };
      price = offer.price;
      offerId = offer.id;
    }
    totalAmount += price * item.quantity;
    orderItemsData.push({
      productId: product.id,
      nameSnapshot: product.name,
      priceSnapshot: price,
      quantity: item.quantity,
      ...(offerId ? { offerId } : {}),
    });
  }

  // Guest checkout stays the default -- if the shopper happens to be logged
  // in as a Покупатель at the moment of checkout, the order is silently
  // linked to their account so it shows up under "Мои заказы".
  const session = await getAdminSession();
  const userId = session?.role === "CUSTOMER" ? session.userId : null;

  let deferred = false;
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        email: true,
        phone: true,
        emailVerifiedAt: true,
        company: { select: { paymentType: true } },
      },
    });
    if (user && needsEmailVerification(user)) {
      return { ok: false, error: "Подтвердите электронную почту — код отправлен на ваш адрес" };
    }
    deferred = user?.company?.paymentType === "DEFERRED";
    // First order of an account without a phone: remember it for next time.
    if (user && !user.phone) {
      await prisma.user.update({ where: { id: userId }, data: { phone: customerPhone } });
    }
  }

  const statuses = await initialLineStatuses(orderItemsData, deferred);
  const orderNumber = await generateOrderNumber();
  const order = await prisma.order.create({
    data: {
      orderNumber,
      customerName,
      customerPhone,
      customerEmail,
      deliveryNote,
      totalAmount,
      userId,
      deferred,
      status: aggregateOrderStatus(statuses),
      items: {
        create: orderItemsData.map((item, i) => ({
          ...item,
          status: statuses[i],
          deferred,
          deliveryMethod: deliveryMethodFromNote(deliveryNote),
        })),
      },
    },
  });

  await orderMissingFromSuppliers(order.id);
  return { ok: true, orderNumber: order.orderNumber };
}
