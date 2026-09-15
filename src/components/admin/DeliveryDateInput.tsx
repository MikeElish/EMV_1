"use client";

import { useState, useTransition } from "react";
import { updateDeliveryDate } from "@/actions/admin/orders";

function toInputValue(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export function DeliveryDateInput({
  orderId,
  deliveryDate,
}: {
  orderId: string;
  deliveryDate: Date | null;
}) {
  const [value, setValue] = useState(toInputValue(deliveryDate));
  const [pending, startTransition] = useTransition();

  function handleChange(next: string) {
    const previous = value;
    setValue(next);
    startTransition(async () => {
      const result = await updateDeliveryDate(orderId, next || null);
      if (!result.ok) setValue(previous);
    });
  }

  return (
    <input
      type="date"
      value={value}
      disabled={pending}
      onChange={(e) => handleChange(e.target.value)}
      className="rounded-md border border-foreground/20 bg-transparent px-2 py-1.5 text-xs outline-none focus:border-foreground/50"
    />
  );
}
