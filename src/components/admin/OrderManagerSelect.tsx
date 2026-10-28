"use client";

import { useState, useTransition } from "react";
import { updateOrderManager } from "@/actions/admin/orders";

export type Employee = { id: string; name: string };

/** «Менеджер» under the order's customer: whose sale it is (Отчёты → Зарплата). */
export function OrderManagerSelect({ orderId, managerId, employees }: { orderId: string; managerId: string | null; employees: Employee[] }) {
  const [value, setValue] = useState(managerId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function change(next: string) {
    const previous = value;
    setValue(next);
    setError(null);
    startTransition(async () => {
      const r = await updateOrderManager(orderId, next || null);
      if (!r.ok) {
        setValue(previous);
        setError(r.error);
      }
    });
  }

  return (
    <div className="mt-1">
      <select
        aria-label="Менеджер заказа"
        title="Менеджер заказа"
        value={value}
        disabled={pending}
        onChange={(e) => change(e.target.value)}
        className="max-w-44 rounded border border-foreground/15 bg-transparent px-1 py-0.5 text-xs text-foreground/70 outline-none focus:border-foreground/50 disabled:opacity-50"
      >
        <option value="">— менеджер —</option>
        {employees.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
