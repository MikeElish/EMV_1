import type { OrderStatus } from "@prisma/client";
import { ORDER_STATUS_LABELS } from "@/lib/validators/orders";

// Text colour = border colour. Statuses still in motion blink (the border
// fades out and back, see .status-blink); finished ones are static.
const STYLES: Record<OrderStatus, { color: string; border: string; blink: boolean }> = {
  CHECKING: { color: "text-orange-600 dark:text-orange-400", border: "border-orange-500", blink: true },
  AWAITING_PAYMENT: { color: "text-yellow-600 dark:text-yellow-500", border: "border-yellow-500", blink: true },
  AWAITING_SUPPLY: { color: "text-violet-600 dark:text-violet-400", border: "border-violet-500", blink: true },
  IN_PROGRESS: { color: "text-green-600 dark:text-green-500", border: "border-green-500", blink: true },
  READY_TO_SHIP: { color: "text-teal-600 dark:text-teal-400", border: "border-teal-500", blink: true },
  SHIPPED_AWAITING_PAYMENT: { color: "text-blue-600 dark:text-blue-500", border: "border-blue-500", blink: true },
  CANCELLED: { color: "text-red-600 dark:text-red-500", border: "border-red-500", blink: false },
  DONE: { color: "text-green-600 dark:text-green-500", border: "border-green-500", blink: false },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const style = STYLES[status];
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-md border px-2 py-1 text-xs font-medium ${style.color} ${style.border} ${
        style.blink ? "status-blink" : ""
      }`}
    >
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}
