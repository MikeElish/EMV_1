"use client";

import { useState, useTransition } from "react";
import { updatePaymentState, type PaymentState } from "@/actions/admin/orders";

const OPTIONS: { value: PaymentState; label: string; className: string }[] = [
  {
    value: "unpaid",
    label: "Не оплачено",
    className: "border-foreground/20 bg-foreground/5 text-foreground/60",
  },
  {
    value: "deferred",
    label: "Отсрочка",
    className: "border-yellow-500 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  },
  {
    value: "paid",
    label: "Оплачено",
    className: "border-green-600 bg-green-600/10 text-green-700 dark:text-green-500",
  },
];

export function paymentStateOf(order: { paid: boolean; deferred: boolean }): PaymentState {
  return order.paid ? "paid" : order.deferred ? "deferred" : "unpaid";
}

export const PAYMENT_STATE_LABELS: Record<PaymentState, string> = {
  unpaid: "Не оплачено",
  deferred: "Отсрочка",
  paid: "Оплачено",
};

/** Оплачено / Не оплачено / Отсрочка. Paid or deferred lets in-stock lines ship. */
export function PaidToggle({ orderId, state }: { orderId: string; state: PaymentState }) {
  const [value, setValue] = useState(state);
  const [pending, startTransition] = useTransition();

  const [synced, setSynced] = useState(state);
  if (state !== synced) {
    setSynced(state);
    setValue(state);
  }

  function change(next: PaymentState) {
    const previous = value;
    setValue(next);
    startTransition(async () => {
      const result = await updatePaymentState(orderId, next);
      if (!result.ok) setValue(previous);
    });
  }

  const current = OPTIONS.find((o) => o.value === value)!;
  return (
    <select
      value={value}
      disabled={pending}
      onChange={(e) => change(e.target.value as PaymentState)}
      aria-label="Оплата"
      className={`rounded-md border px-2 py-1 text-xs outline-none transition-opacity disabled:opacity-50 ${current.className}`}
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value} className="bg-background text-foreground">
          {o.label}
        </option>
      ))}
    </select>
  );
}
