"use server";

import { prisma } from "@/lib/prisma";
import { checkoutSchema, type CheckoutInput } from "@/lib/validators/checkout";
import { getAdminSession } from "@/lib/session";
import { generateOrderNumber } from "@/lib/order-number-db";
import { needsEmailVerification } from "@/lib/email-verification";
import { aggregateOrderStatus, initialLineStatuses, orderMissingFromSuppliers } from "@/lib/order-status";
import { sendPriceRequests } from "@/lib/price-requests";
import { getShopOffers } from "@/lib/supplier-offers";
import { deliveryMethodFromNote } from "@/lib/delivery";
import { sessionPriceTier } from "@/lib/customer-pricing";
import { tierPrice } from "@/lib/pricing";
import { applyOrderSurcharges, quoteSurcharges } from "@/lib/order-surcharge";

export type CheckoutResult =
  | { ok: true; orderNumber: string }
  | { ok: false; error: string };

type CartLine = { productId: string; nameSnapshot: string; priceSnapshot: number; quantity: number; offerId?: string };

/** The cart at the prices charged: the client's «Тип цен» and picked offers, worked out here, never taken from the browser. */
async function priceCart(items: CheckoutInput["items"]): Promise<{ ok: true; lines: CartLine[] } | { ok: false; error: string }> {
  const productIds = items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true },
    include: { pricing: { select: { purchasePrice: true, retailPrice: true, dealerPrice: true } } },
  });
  // A client company's «Тип цен» (Розница / Дилер / Индивидуальный) is charged here, never taken from the browser.
  const tier = await sessionPriceTier();

  if (products.length !== new Set(productIds).size) {
    return { ok: false, error: "Часть товаров в корзине больше недоступна" };
  }

  const productById = new Map(products.map((p) => [p.id, p]));
  // A picked supplier offer is charged at its own site price -- worked out
  // here, never taken from the browser.
  const offers = await getShopOffers(items.filter((i) => i.offerId).map((i) => i.productId), tier);

  const orderItemsData: CartLine[] = [];
  for (const item of items) {
    const product = productById.get(item.productId)!;
    let price = tierPrice(product, tier);
    let offerId: string | undefined;
    if (item.offerId) {
      const offer = offers[item.productId]?.find((o) => o.id === item.offerId);
      if (!offer) return { ok: false, error: `Предложение по «${product.name}» изменилось — обновите корзину` };
      price = offer.price;
      offerId = offer.id;
    }
    orderItemsData.push({
      productId: product.id,
      nameSnapshot: product.name,
      priceSnapshot: price,
      quantity: item.quantity,
      ...(offerId ? { offerId } : {}),
    });
  }
  return { ok: true, lines: orderItemsData };
}

export type CheckoutQuote = { ok: true; surcharges: number[]; surchargeTotal: number } | { ok: false; error: string };

/** «Оформление заказа»: what the lines «Под заказ» add (src/lib/order-surcharge.ts), per cart line and in all. */
export async function quoteCheckout(items: CheckoutInput["items"]): Promise<CheckoutQuote> {
  const parsed = checkoutSchema.shape.items.safeParse(items);
  if (!parsed.success) return { ok: false, error: "Корзина пуста" };
  const priced = await priceCart(parsed.data);
  if (!priced.ok) return priced;
  const surcharges = await quoteSurcharges(priced.lines.map((l) => ({ productId: l.productId, quantity: l.quantity, price: l.priceSnapshot, offerId: l.offerId })));
  return { ok: true, surcharges, surchargeTotal: surcharges.reduce((s, x, n) => s + x * priced.lines[n].quantity, 0) };
}

export async function createOrder(
  input: CheckoutInput
): Promise<CheckoutResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }
  const { customerName, customerPhone, customerEmail, deliveryNote, items, termsAccepted } =
    parsed.data;
  const priced = await priceCart(items);
  if (!priced.ok) return priced;
  const orderItemsData = priced.lines;
  const totalAmount = orderItemsData.reduce((s, l) => s + l.priceSnapshot * l.quantity, 0);

  // Guest checkout stays the default -- if the shopper happens to be logged
  // in as a Покупатель at the moment of checkout, the order is silently
  // linked to their account so it shows up under "Мои заказы".
  const session = await getAdminSession();
  const userId = session?.role === "CUSTOMER" ? session.userId : null;

  let deferred = false;
  let privateCustomer = true;
  // Отчёты → Зарплата: the sale of the client company's manager.
  let managerId: string | null = null;
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        email: true,
        phone: true,
        emailVerifiedAt: true,
        company: { select: { id: true, paymentType: true, managerId: true } },
      },
    });
    if (user && needsEmailVerification(user)) {
      return { ok: false, error: "Подтвердите электронную почту — код отправлен на ваш адрес" };
    }
    deferred = user?.company?.paymentType === "DEFERRED";
    privateCustomer = !user?.company;
    managerId = user?.company?.managerId ?? null;
    // First order of an account without a phone: remember it for next time.
    if (user && !user.phone) {
      await prisma.user.update({ where: { id: userId }, data: { phone: customerPhone } });
    }
  }

  // A private customer agrees to the terms of supply (a company gets them in its invoice).
  if (privateCustomer && !termsAccepted) return { ok: false, error: "Подтвердите согласие с условиями поставки" };

  // A line «По запросу» (no price yet) always goes to Проценка first.
  const statuses = (await initialLineStatuses(orderItemsData, deferred)).map((s, i) =>
    orderItemsData[i].priceSnapshot > 0 ? s : ("CHECKING" as const)
  );
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
      termsAcceptedAt: privateCustomer ? new Date() : null,
      managerId,
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
  await applyOrderSurcharges(order.id);
  // Lines not in stock: their suppliers are asked for prices by mail, in the background.
  void sendPriceRequests(order.id).catch((error) => console.error("[price-requests] order", order.orderNumber, error));
  return { ok: true, orderNumber: order.orderNumber };
}
