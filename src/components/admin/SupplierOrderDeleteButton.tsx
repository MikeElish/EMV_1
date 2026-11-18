"use client";

import { deleteSupplierOrderLine } from "@/actions/admin/price-check";
import { DeleteButton } from "@/components/admin/DeleteButton";

export function SupplierOrderDeleteButton({ id, variant = "link" }: { id: string; variant?: "link" | "menu" }) {
  return (
    <DeleteButton
      action={deleteSupplierOrderLine.bind(null, id)}
      confirmText="Убрать позицию из заказа поставщику?"
      variant={variant}
    />
  );
}
