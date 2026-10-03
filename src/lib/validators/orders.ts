import type { OrderStatus, OrderDocumentCategory } from "@prisma/client";

// Listed in the order an order line normally moves through them; also the
// order of the status dropdowns.
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  CHECKING: "Проверка заказа",
  AWAITING_PAYMENT: "Требуется оплата",
  AWAITING_SUPPLY: "Ожидание поставки",
  IN_PROGRESS: "В работе",
  READY_TO_SHIP: "Готов к отгрузке",
  SHIPPED_AWAITING_PAYMENT: "Отгружено, требуется оплата",
  DONE: "Завершено",
  CANCELLED: "Отменено",
};

/** Least to most advanced; an order with mixed lines shows the least advanced one. */
export const ORDER_STATUS_PROGRESS: OrderStatus[] = [
  "CHECKING",
  "AWAITING_PAYMENT",
  "AWAITING_SUPPLY",
  "IN_PROGRESS",
  "READY_TO_SHIP",
  "SHIPPED_AWAITING_PAYMENT",
  "DONE",
];

/** Lines holding goods for a customer -- the "Резерв" in CRM → Товары. */
export const RESERVE_STATUSES: OrderStatus[] = ["IN_PROGRESS", "READY_TO_SHIP", "AWAITING_SUPPLY"];

/** Reserved lines whose goods are already on the shelf (counted against free stock). */
export const STOCK_HOLDING_STATUSES: OrderStatus[] = ["IN_PROGRESS", "READY_TO_SHIP"];

/** Goods have left the warehouse. */
export const SHIPPED_STATUSES: OrderStatus[] = ["SHIPPED_AWAITING_PAYMENT", "DONE"];

/** A customer may still cancel these lines themselves. */
export const CUSTOMER_CANCELLABLE_STATUSES: OrderStatus[] = ["CHECKING", "AWAITING_PAYMENT"];

export const ORDER_DOCUMENT_CATEGORY_LABELS: Record<OrderDocumentCategory, string> = {
  INVOICE: "Счёт на оплату",
  UPD: "УПД",
  WAYBILL: "Транспортная накладная",
};
