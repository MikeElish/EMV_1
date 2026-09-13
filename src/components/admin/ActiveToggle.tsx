"use client";

import { useTransition } from "react";
import { toggleProductActive } from "@/actions/admin/products";

export function ActiveToggle({
  productId,
  isActive,
}: {
  productId: string;
  isActive: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await toggleProductActive(productId, !isActive);
        })
      }
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        isActive
          ? "bg-green-600/10 text-green-700 dark:text-green-500"
          : "bg-foreground/10 text-foreground/50"
      }`}
    >
      {isActive ? "Да" : "Нет"}
    </button>
  );
}
