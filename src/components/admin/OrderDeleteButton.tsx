"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteOrderAsOwner, deleteOrderLineAsOwner } from "@/actions/admin/orders";
import { Modal } from "@/components/Modal";

/**
 * Владелец: removes an order line or the whole order from the journal. With
 * one line (or from the grouped list) it is the order itself.
 */
export function OrderDeleteButton({
  orderId,
  orderNumber,
  itemId,
  lines,
}: {
  orderId: string;
  orderNumber: string;
  /** The line of this row; none in the grouped list. */
  itemId?: string;
  /** Lines in the order. */
  lines: number;
}) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const lineOnly = !!itemId && lines > 1;

  function run(scope: "line" | "order") {
    setError(null);
    startTransition(async () => {
      const result = scope === "line" && itemId ? await deleteOrderLineAsOwner(itemId) : await deleteOrderAsOwner(orderId);
      if (!result.ok) setError(result.error);
      else {
        setAsking(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <button
        type="button"
        data-edit-only
        onClick={(e) => {
          e.stopPropagation();
          setAsking(true);
        }}
        className="text-sm text-red-600 hover:underline"
      >
        Удалить
      </button>
      {asking && (
        <Modal onClose={() => !pending && setAsking(false)} maxWidthClassName="max-w-sm">
          <h2 className="text-lg font-semibold">Удаление</h2>
          <p className="mt-2 text-sm text-foreground/70">
            {lineOnly
              ? `Удалить эту позицию или весь заказ № ${orderNumber}?`
              : `Удалить заказ № ${orderNumber}${lines > 1 ? ` (позиций: ${lines})` : ""}?`}{" "}
            Запись исчезнет из журналов без возможности восстановления.
          </p>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <div className="mt-5 flex flex-wrap gap-3">
            {lineOnly && (
              <button
                type="button"
                onClick={() => run("line")}
                disabled={pending}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                Эту позицию
              </button>
            )}
            <button
              type="button"
              onClick={() => run("order")}
              disabled={pending}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {lineOnly ? "Весь заказ" : "Удалить"}
            </button>
            <button
              type="button"
              onClick={() => setAsking(false)}
              disabled={pending}
              className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium hover:bg-foreground/5 disabled:opacity-50"
            >
              Отмена
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
