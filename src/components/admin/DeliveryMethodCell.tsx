"use client";

import type { DeliveryMethod } from "@prisma/client";
import { updateLineDelivery } from "@/actions/admin/orders";
import { DELIVERY_METHOD_LABELS, DELIVERY_METHODS } from "@/lib/delivery";
import { useLineChange } from "@/components/admin/LineChange";

/**
 * Delivery type of one line. A change goes to the customer for confirmation;
 * until they answer, the cell says so.
 */
export function DeliveryMethodCell({
  itemId,
  method,
  confirmPending,
  activeLines,
}: {
  itemId: string;
  method: DeliveryMethod | null;
  confirmPending: boolean;
  activeLines: number;
}) {
  const line = useLineChange<DeliveryMethod | "">({
    current: method ?? "",
    activeLines,
    apply: (value, scope) =>
      value ? updateLineDelivery(itemId, value, scope) : Promise.resolve({ ok: true as const }),
    question: (v) =>
      `Сменить тип доставки остальных позиций заказа на «${v ? DELIVERY_METHOD_LABELS[v] : "—"}»?`,
  });

  return (
    <>
      <select
        value={line.value}
        disabled={line.pending}
        onChange={(e) => line.change(e.target.value as DeliveryMethod)}
        aria-label="Доставка"
        className={`rounded-md border bg-background px-2 py-1.5 text-xs outline-none focus:border-foreground/50 ${
          confirmPending ? "border-yellow-500" : "border-foreground/20"
        }`}
      >
        {!method && <option value="">—</option>}
        {DELIVERY_METHODS.map((m) => (
          <option key={m} value={m}>
            {DELIVERY_METHOD_LABELS[m]}
          </option>
        ))}
      </select>
      {confirmPending && (
        <p className="mt-1 whitespace-nowrap text-[11px] text-yellow-700 dark:text-yellow-400">
          Ждёт подтверждения покупателя
        </p>
      )}
      {line.errorText}
      {line.dialog}
    </>
  );
}
