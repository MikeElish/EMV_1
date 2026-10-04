"use client";

import { updateOrderItemStatus } from "@/actions/admin/orders";
import { ORDER_STATUS_LABELS } from "@/lib/validators/orders";
import { useLineChange } from "@/components/admin/LineChange";
import type { OrderStatus } from "@prisma/client";

const OPTIONS = (Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map((value) => ({
  value,
  label: ORDER_STATUS_LABELS[value],
}));

/** Status of one order line; offers the same status for the order's other lines. */
export function OrderStatusSelect({
  itemId,
  status,
  activeLines,
}: {
  itemId: string;
  status: OrderStatus;
  /** Lines of the order that aren't cancelled. */
  activeLines: number;
}) {
  const line = useLineChange<OrderStatus>({
    current: status,
    activeLines,
    apply: (value, scope) => updateOrderItemStatus(itemId, value, scope),
    question: (v) => `Сменить статус остальных позиций заказа на «${ORDER_STATUS_LABELS[v]}»?`,
  });

  return (
    <>
      <select
        value={line.value}
        disabled={line.pending}
        onChange={(e) => line.change(e.target.value as OrderStatus)}
        className="rounded-md border border-foreground/20 bg-background px-2 py-1.5 text-xs outline-none focus:border-foreground/50"
      >
        {OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {line.errorText}
      {line.dialog}
    </>
  );
}
