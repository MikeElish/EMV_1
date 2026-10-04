"use client";

import { updateLinePayment, type PaymentState } from "@/actions/admin/orders";
import { useLineChange } from "@/components/admin/LineChange";

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

export function paymentStateOf(line: { paid: boolean; deferred: boolean }): PaymentState {
  return line.paid ? "paid" : line.deferred ? "deferred" : "unpaid";
}

export const PAYMENT_STATE_LABELS: Record<PaymentState, string> = {
  unpaid: "Не оплачено",
  deferred: "Отсрочка",
  paid: "Оплачено",
};

/** Оплачено / Не оплачено / Отсрочка of one line. Paid or deferred lets in-stock lines ship. */
export function PaidToggle({
  itemId,
  state,
  activeLines,
}: {
  itemId: string;
  state: PaymentState;
  activeLines: number;
}) {
  const line = useLineChange<PaymentState>({
    current: state,
    activeLines,
    apply: (value, scope) => updateLinePayment(itemId, value, scope),
    question: (v) => `Сменить оплату остальных позиций заказа на «${PAYMENT_STATE_LABELS[v]}»?`,
  });

  const current = OPTIONS.find((o) => o.value === line.value)!;
  return (
    <>
      <select
        value={line.value}
        disabled={line.pending}
        onChange={(e) => line.change(e.target.value as PaymentState)}
        aria-label="Оплата"
        className={`rounded-md border px-2 py-1 text-xs outline-none transition-opacity disabled:opacity-50 ${current.className}`}
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value} className="bg-background text-foreground">
            {o.label}
          </option>
        ))}
      </select>
      {line.errorText}
      {line.dialog}
    </>
  );
}
