import type { OrderStatus } from "@prisma/client";
import { ORDER_STATUS_LABELS } from "@/lib/validators/orders";

const STYLES: Record<OrderStatus, { color: string; border: string; blink: string | null }> = {
  AWAITING_PAYMENT: {
    color: "text-yellow-600 dark:text-yellow-500",
    border: "border-yellow-500",
    blink: "status-blink-yellow",
  },
  IN_PROGRESS: {
    color: "text-green-600 dark:text-green-500",
    border: "border-green-500",
    blink: "status-blink-green",
  },
  SHIPPED_AWAITING_PAYMENT: {
    color: "text-blue-600 dark:text-blue-500",
    border: "border-blue-500",
    blink: "status-blink-blue",
  },
  CANCELLED: {
    color: "text-red-600 dark:text-red-500",
    border: "border-red-500",
    blink: null,
  },
  DONE: {
    color: "text-green-600 dark:text-green-500",
    border: "border-green-500",
    blink: null,
  },
};

export function OrderStatusBadge({
  status,
  cancelled,
}: {
  status: OrderStatus;
  /** An individually cancelled order item renders as "Отменено", regardless of the order's own status. */
  cancelled?: boolean;
}) {
  const effectiveStatus: OrderStatus = cancelled ? "CANCELLED" : status;
  const style = STYLES[effectiveStatus];
  const label = cancelled ? "Отменено" : ORDER_STATUS_LABELS[status];

  return (
    <span
      className={`inline-block rounded-md border px-2 py-1 text-xs font-medium ${style.color} ${style.border} ${
        style.blink ?? ""
      }`}
    >
      {label}
    </span>
  );
}
