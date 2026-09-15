"use client";

import { useState, useTransition } from "react";
import { updateOrderStatus } from "@/actions/admin/orders";
import { ORDER_STATUS_LABELS } from "@/lib/validators/orders";
import type { OrderStatus } from "@prisma/client";

const OPTIONS = (Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map((value) => ({
  value,
  label: ORDER_STATUS_LABELS[value],
}));

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
      className="rounded-md border border-foreground/20 bg-transparent px-2 py-1.5 text-xs outline-none focus:border-foreground/50"
    >
      {OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
