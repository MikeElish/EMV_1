"use client";

import { updateLineDeliveryDate } from "@/actions/admin/orders";
import { useLineChange } from "@/components/admin/LineChange";

function toInputValue(date: Date | null): string {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

function formatDay(value: string) {
  return value ? value.split("-").reverse().join(".") : "без даты";
}

/** Planned delivery date of one line; offers the same date for the order's other lines. */
export function DeliveryDateInput({
  itemId,
  deliveryDate,
  activeLines,
}: {
  itemId: string;
  deliveryDate: Date | null;
  activeLines: number;
}) {
  const line = useLineChange<string>({
    current: toInputValue(deliveryDate),
    activeLines,
    apply: (value, scope) => updateLineDeliveryDate(itemId, value || null, scope),
    question: (v) => `Установить дату поставки ${formatDay(v)} для остальных позиций заказа?`,
  });

  return (
    <>
      <input
        type="date"
        value={line.value}
        disabled={line.pending}
        onChange={(e) => line.change(e.target.value)}
        className="rounded-md border border-foreground/20 bg-transparent px-2 py-1.5 text-xs outline-none focus:border-foreground/50"
      />
      {line.errorText}
      {line.dialog}
    </>
  );
}
