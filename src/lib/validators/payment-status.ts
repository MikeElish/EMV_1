export type PaymentDisplayStatus =
  | { kind: "unpaid" }
  | { kind: "paid" }
  | { kind: "deferred"; date: Date; graceActive: boolean };

/**
 * `graceActive` follows the exact (confirmed, deliberately non-intuitive)
 * spec: planned date <= today -> "Отсрочка платежа" (graceActive: true);
 * planned date > today -> "Пропущен платёж!" (graceActive: false).
 */
export function getPaymentDisplayStatus(order: {
  paid: boolean;
  plannedPaymentDate: Date | null;
}): PaymentDisplayStatus {
  if (order.paid) return { kind: "paid" };

  if (order.plannedPaymentDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const planned = new Date(order.plannedPaymentDate);
    planned.setHours(0, 0, 0, 0);
    const graceActive = planned.getTime() <= today.getTime();
    return { kind: "deferred", date: order.plannedPaymentDate, graceActive };
  }

  return { kind: "unpaid" };
}
