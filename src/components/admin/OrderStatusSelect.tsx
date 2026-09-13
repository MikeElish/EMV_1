"use client";

import { useState, useTransition } from "react";
import { updateOrderStatus } from "@/actions/admin/orders";
import type { OrderStatus } from "@prisma/client";

const OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: "NEW", label: "Новый" },
  { value: "PAID", label: "Оплачен" },
  { value: "PROCESSING", label: "В обработке" },
  { value: "SHIPPED", label: "Отправлен" },
  { value: "DONE", label: "Выполнен" },
  { value: "CANCELLED", label: "Отменён" },
];

export function OrderStatusSelect({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  const [value, setValue] = useState(status);
  const [pending, startTransition] = useTransition();

  function handleChange(next: OrderStatus) {
    const previous = value;
    setValue(next);
    startTransition(async () => {
      const result = await updateOrderStatus(orderId, next);
      if (!result.ok) setValue(previous);
    });
  }

  return (
    <select
      value={value}
      disabled={pending}
      onChange={(e) => handleChange(e.target.value as OrderStatus)}
      className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/50"
    >
      {OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
