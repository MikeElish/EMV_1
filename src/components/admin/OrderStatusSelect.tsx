"use client";

import { useState, useTransition } from "react";
import { updateOrderItemStatus } from "@/actions/admin/orders";
import { ORDER_STATUS_LABELS } from "@/lib/validators/orders";
import { Modal } from "@/components/Modal";
import type { OrderStatus } from "@prisma/client";

const OPTIONS = (Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map((value) => ({
  value,
  label: ORDER_STATUS_LABELS[value],
}));

/**
 * Status of one order line. In an order with several active lines it asks
 * whether to change just this line or the whole order.
 */
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
  const [value, setValue] = useState(status);
  const [asking, setAsking] = useState<OrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Follow the server after a refresh (another line or the payment changed it).
  const [synced, setSynced] = useState(status);
  if (status !== synced) {
    setSynced(status);
    setValue(status);
  }

  function apply(next: OrderStatus, scope: "item" | "order") {
    const previous = value;
    setAsking(null);
    setError(null);
    setValue(next);
    startTransition(async () => {
      const result = await updateOrderItemStatus(itemId, next, scope);
      if (!result.ok) {
        setValue(previous);
        setError(result.error);
      }
    });
  }

  function handleChange(next: OrderStatus) {
    if (activeLines > 1) setAsking(next);
    else apply(next, "item");
  }

  return (
    <>
      <select
        value={value}
        disabled={pending}
        onChange={(e) => handleChange(e.target.value as OrderStatus)}
        className="rounded-md border border-foreground/20 bg-background px-2 py-1.5 text-xs outline-none focus:border-foreground/50"
      >
        {OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {asking && (
        <Modal onClose={() => setAsking(null)}>
          <h2 className="text-lg font-semibold">Изменить статус</h2>
          <p className="mt-2 text-sm text-foreground/70">
            Новый статус «{ORDER_STATUS_LABELS[asking]}» — для этой позиции или для всего заказа?
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => apply(asking, "item")}
              className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
            >
              Эта позиция
            </button>
            <button
              type="button"
              onClick={() => apply(asking, "order")}
              className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium hover:bg-foreground/5"
            >
              Весь заказ
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
