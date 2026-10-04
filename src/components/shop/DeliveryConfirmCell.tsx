"use client";

import { useState, useTransition } from "react";
import type { DeliveryMethod } from "@prisma/client";
import { respondDeliveryChange } from "@/actions/shop/orders";
import { DELIVERY_METHOD_LABELS } from "@/lib/delivery";
import { DropdownMenu } from "@/components/DropdownMenu";
import { Modal } from "@/components/Modal";

/**
 * «Доставка» in Мои заказы. A type changed by the shop blinks yellow with
 * «Требуется подтверждение»; a click offers «Подтверждаю» / «Отклонить», and
 * if other lines of the order wait too, whether to answer for all of them.
 */
export function DeliveryConfirmCell({
  itemId,
  method,
  pending,
  otherPending,
}: {
  itemId: string;
  method: DeliveryMethod | null;
  pending: boolean;
  /** Other lines of the same order waiting for the same answer. */
  otherPending: number;
}) {
  const [asking, setAsking] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const label = method ? DELIVERY_METHOD_LABELS[method] : "—";

  if (!pending) return <span>{label}</span>;

  function answer(accept: boolean, scope: "item" | "order") {
    setAsking(null);
    setError(null);
    startTransition(async () => {
      const result = await respondDeliveryChange(itemId, accept, scope);
      if (!result.ok) setError(result.error);
    });
  }

  function choose(accept: boolean) {
    if (otherPending > 0) setAsking(accept);
    else answer(accept, "item");
  }

  return (
    <>
      <DropdownMenu
        label={
          <span className="flex flex-col items-start gap-0.5 text-left">
            <span className="status-blink inline-block whitespace-nowrap rounded-md border border-yellow-500 px-2 py-1 text-xs font-medium text-yellow-600 dark:text-yellow-500">
              {label}
            </span>
            <span className="whitespace-nowrap text-[11px] text-yellow-700 dark:text-yellow-400">
              {busy ? "Сохраняем..." : "Требуется подтверждение"}
            </span>
          </span>
        }
        buttonClassName="cursor-pointer"
      >
        {(close) => (
          <>
            <button
              type="button"
              onClick={() => {
                close();
                choose(true);
              }}
              className="block w-full px-3 py-2 text-left font-medium text-green-600 hover:bg-green-600/10 dark:text-green-500"
            >
              Подтверждаю
            </button>
            <button
              type="button"
              onClick={() => {
                close();
                choose(false);
              }}
              className="block w-full px-3 py-2 text-left font-medium text-red-600 hover:bg-red-600/10 dark:text-red-500"
            >
              Отклонить
            </button>
          </>
        )}
      </DropdownMenu>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {asking !== null && (
        <Modal onClose={() => setAsking(null)} maxWidthClassName="max-w-sm">
          <h2 className="text-lg font-bold">{asking ? "Подтвердить" : "Отклонить"} изменение</h2>
          <p className="mt-2 text-sm text-foreground/60">
            Тип доставки изменён ещё у {otherPending} {otherPending === 1 ? "позиции" : "позиций"} этого
            заказа. Применить ко всем позициям с изменённым типом доставки?
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => answer(asking, "order")}
              className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
            >
              Да, ко всем
            </button>
            <button
              type="button"
              onClick={() => answer(asking, "item")}
              className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium hover:bg-foreground/5"
            >
              Только к этой
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
