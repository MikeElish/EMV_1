"use client";

import { useState } from "react";
import type { DeliveryMethod } from "@prisma/client";
import { updateLineDelivery } from "@/actions/admin/orders";
import { DELIVERY_METHOD_LABELS, DELIVERY_METHODS } from "@/lib/delivery";
import { useLineChange } from "@/components/admin/LineChange";

const NEEDS_DAYS: DeliveryMethod[] = ["ADDRESS", "TERMINAL"];

/**
 * Delivery type of one line. A change goes to the customer for confirmation;
 * until they answer, the cell says so. ADDRESS/TERMINAL also asks for delivery
 * days; the days input appears on the left, the select shrinks so the column
 * width stays the same.
 */
export function DeliveryMethodCell({
  itemId,
  method,
  days,
  confirmPending,
  activeLines,
}: {
  itemId: string;
  method: DeliveryMethod | null;
  days: number;
  confirmPending: boolean;
  activeLines: number;
}) {
  const [dayCount, setDayCount] = useState(String(days || ""));
  const needsDays = method ? NEEDS_DAYS.includes(method) : false;

  const line = useLineChange<DeliveryMethod | "">({
    current: method ?? "",
    activeLines,
    apply: (value, scope) =>
      value ? updateLineDelivery(itemId, value, scope) : Promise.resolve({ ok: true as const }),
    question: (v) =>
      `Сменить тип доставки остальных позиций заказа на «${v ? DELIVERY_METHOD_LABELS[v] : "—"}»?`,
  });

  async function saveDays(raw: string) {
    const n = raw === "" ? 0 : Number(raw);
    if (Number.isNaN(n) || n < 0) return;
    setDayCount(raw);
    if (!method || !NEEDS_DAYS.includes(method)) return;
    await updateLineDelivery(itemId, method, "item", n);
  }

  return (
    <div className="flex items-center gap-1.5">
      {needsDays && (
        <input
          type="number"
          min={0}
          value={dayCount}
          onChange={(e) => setDayCount(e.target.value)}
          onBlur={(e) => saveDays(e.target.value)}
          placeholder="дн"
          title="Дней доставки"
          className="w-12 rounded-md border border-foreground/20 bg-transparent px-1.5 py-1 text-xs text-center outline-none focus:border-foreground/50"
        />
      )}
      <select
        value={line.value}
        disabled={line.pending}
        onChange={(e) => line.change(e.target.value as DeliveryMethod)}
        aria-label="Доставка"
        className={`rounded-md border bg-background px-2 py-1.5 text-xs outline-none focus:border-foreground/50 ${
          confirmPending ? "border-yellow-500" : "border-foreground/20"
        } ${needsDays ? "min-w-0 flex-1" : "w-full"}`}
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
    </div>
  );
}
