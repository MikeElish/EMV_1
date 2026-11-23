"use client";

import { updateSupplierOrderStatus } from "@/actions/admin/supplier-orders";
import { SUPPLIER_ORDER_STATUS_LABELS } from "@/lib/validators/supplier-orders";
import { useLineChange } from "@/components/admin/LineChange";
import type { SupplierOrderStatus } from "@prisma/client";

const OPTIONS = (Object.keys(SUPPLIER_ORDER_STATUS_LABELS) as SupplierOrderStatus[]).map((value) => ({
  value,
  label: SUPPLIER_ORDER_STATUS_LABELS[value],
}));

/** Status of one supplier order line; offers the same status for the purchase's other lines. */
export function SupplierOrderStatusSelect({
  id,
  status,
  canEdit,
  activeLines,
}: {
  id: string;
  status: SupplierOrderStatus;
  canEdit: boolean;
  activeLines: number;
}) {
  const line = useLineChange<SupplierOrderStatus>({
    current: status,
    activeLines,
    apply: (value, scope) => updateSupplierOrderStatus(id, value, scope),
    question: (v) => `Сменить статус остальных позиций заказа поставщику на «${SUPPLIER_ORDER_STATUS_LABELS[v]}»?`,
  });

  if (!canEdit) return <span>{SUPPLIER_ORDER_STATUS_LABELS[status]}</span>;

  return (
    <>
      <select
        value={line.value}
        disabled={line.pending}
        onChange={(e) => line.change(e.target.value as SupplierOrderStatus)}
        aria-label="Статус"
        className="rounded-md border border-foreground/20 bg-background px-2 py-1.5 text-xs outline-none focus:border-foreground/50"
      >
        {OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {line.errorText}
      {line.dialog}
    </>
  );
}
