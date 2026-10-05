import type { OrderStatus, SupplierOrderStatus } from "@prisma/client";

// Listed in the order a supplier order line normally moves through them.
export const SUPPLIER_ORDER_STATUS_LABELS: Record<SupplierOrderStatus, string> = {
  TO_CHECK: "Проверить",
  REQUESTED: "В запросе",
  CHECKED: "Проверено",
  TO_ORDER: "Заказать",
  AWAITING_PAYMENT: "Требуется оплата",
  ORDERED: "Заказано",
  DELIVERED: "Поставлено",
};

/** The customer order line's status that goes with each supplier order status. */
export const ORDER_STATUS_OF_SUPPLIER: Record<SupplierOrderStatus, OrderStatus> = {
  TO_CHECK: "CHECKING",
  REQUESTED: "CHECKING",
  CHECKED: "AWAITING_PAYMENT",
  TO_ORDER: "AWAITING_SUPPLY",
  AWAITING_PAYMENT: "AWAITING_SUPPLY",
  ORDERED: "AWAITING_SUPPLY",
  DELIVERED: "READY_TO_SHIP",
};

/**
 * The supplier order status a line takes when its customer line moved (in
 * CRM → Заказы, or on payment) to a status outside the current group --
 * e.g. paid and now «Ожидание поставки» → «Заказать». Null: leave it be.
 */
export function supplierStatusFor(orderStatus: OrderStatus, current: SupplierOrderStatus): SupplierOrderStatus | null {
  if (ORDER_STATUS_OF_SUPPLIER[current] === orderStatus) return null;
  switch (orderStatus) {
    case "CHECKING":
      return "TO_CHECK";
    case "AWAITING_PAYMENT":
      return "CHECKED";
    case "AWAITING_SUPPLY":
      return "TO_ORDER";
    case "READY_TO_SHIP":
    case "SHIPPED_AWAITING_PAYMENT":
    case "DONE":
      return current === "DELIVERED" ? null : "DELIVERED";
    default:
      return null;
  }
}
