"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/Modal";

type Result = { ok: true } | { ok: false; error: string };
export type LineScope = "item" | "order";

/**
 * Editing one field of an order line in CRM → Заказы (status, delivery,
 * delivery date, payment). With other active lines in the order it first asks
 * whether to set the same value for them too -- one server call either way.
 */
export function useLineChange<T>({
  current,
  activeLines,
  apply,
  question,
}: {
  current: T;
  activeLines: number;
  apply: (value: T, scope: LineScope) => Promise<Result>;
  /** E.g. (v) => `Сменить статус остальных позиций заказа на «${label(v)}»?` */
  question: (value: T) => string;
}) {
  const [value, setValue] = useState(current);
  const [asking, setAsking] = useState<{ value: T } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Follow the server after a refresh (another line or an automatic rule changed it).
  const [synced, setSynced] = useState(current);
  if (current !== synced) {
    setSynced(current);
    setValue(current);
  }

  function run(next: T, scope: LineScope) {
    const previous = synced;
    setAsking(null);
    setError(null);
    setValue(next);
    startTransition(async () => {
      const result = await apply(next, scope);
      if (!result.ok) {
        setValue(previous);
        setError(result.error);
      }
    });
  }

  function change(next: T) {
    if (activeLines > 1) {
      setValue(next);
      setAsking({ value: next });
    } else run(next, "item");
  }

  function cancel() {
    setAsking(null);
    setValue(synced);
  }

  const dialog = asking && (
    <Modal onClose={cancel} maxWidthClassName="max-w-sm">
      <h2 className="text-lg font-semibold">Остальные позиции заказа</h2>
      <p className="mt-2 text-sm text-foreground/70">{question(asking.value)}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => run(asking.value, "order")}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          Да, всем позициям
        </button>
        <button
          type="button"
          onClick={() => run(asking.value, "item")}
          className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium hover:bg-foreground/5"
        >
          Нет, только этой
        </button>
      </div>
    </Modal>
  );

  const errorText = error && <p className="mt-1 text-xs text-red-600">{error}</p>;
  return { value, pending, change, dialog, errorText };
}
