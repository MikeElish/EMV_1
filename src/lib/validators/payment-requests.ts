export const PAYMENT_REQUEST_STATUSES = ["Требуется оплата", "Оплачено", "Отменено"] as const;
export type PaymentRequestStatus = (typeof PAYMENT_REQUEST_STATUSES)[number];

export type PaymentRequestInput = {
  id: string | null;
  companyId: string | null;
  orderId: string | null;
  /** kopecks */
  amount: number;
  purpose: string;
};
