"use client";

import { useState, useTransition } from "react";
import { updatePaid } from "@/actions/admin/orders";

export function PaidToggle({ orderId, paid }: { orderId: string; paid: boolean }) {
  const [value, setValue] = useState(paid);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const previous = value;
    const next = !value;
    setValue(next);
    startTransition(async () => {
      const result = await updatePaid(orderId, next);
      if (!result.ok) setValue(previous);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={`rounded-md border px-2 py-1 text-xs transition-opacity hover:opacity-80 disabled:opacity-50 ${
        value
          ? "border-green-600 bg-green-600/10 text-green-700 dark:text-green-500"
          : "border-foreground/20 bg-foreground/5 text-foreground/60"
      }`}
    >
      {value ? "Оплачено" : "Не оплачено"}
    </button>
  );
}
