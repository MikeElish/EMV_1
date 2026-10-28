"use server";

import { prisma } from "@/lib/prisma";
import { SbpError, checkSbpPayment, startSbpPayment } from "@/lib/sbp";

export type PayResult = { ok: true; url: string } | { ok: false; error: string };

/** «Оплатить по СБП» on the order's page: the link of Точка's payment page. */
export async function payOrderBySbp(orderNumber: string): Promise<PayResult> {
  const order = await prisma.order.findUnique({ where: { orderNumber }, select: { id: true } });
  if (!order) return { ok: false, error: "Заказ не найден" };
  try {
    return { ok: true, url: await startSbpPayment(order.id) };
  } catch (error) {
    console.error("[sbp] start", orderNumber, error);
    return { ok: false, error: error instanceof SbpError ? error.message : "Не удалось создать платёж. Попробуйте позже или свяжитесь с менеджером." };
  }
}

/** Back from the payment page: whether it went through. */
export async function orderPaymentStatus(orderNumber: string, paymentId: string): Promise<"paid" | "pending" | "failed"> {
  const payment = await prisma.payment.findFirst({ where: { id: paymentId, order: { orderNumber } }, select: { id: true } });
  if (!payment) return "failed";
  const status = await checkSbpPayment(payment.id).catch(() => "PENDING" as const);
  return status === "SUCCEEDED" ? "paid" : status === "PENDING" ? "pending" : "failed";
}
