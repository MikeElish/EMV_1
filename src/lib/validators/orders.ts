import type { OrderStatus, OrderDocumentCategory } from "@prisma/client";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  AWAITING_PAYMENT: "Требуется оплата",
  IN_PROGRESS: "В работе",
  SHIPPED_AWAITING_PAYMENT: "Отгружено, требуется оплата",
  CANCELLED: "Отменено",
  DONE: "Завершено",
};

export const ORDER_DOCUMENT_CATEGORY_LABELS: Record<OrderDocumentCategory, string> = {
  INVOICE: "Счёт на оплату",
  UPD: "УПД",
  WAYBILL: "Транспортная накладная",
};
