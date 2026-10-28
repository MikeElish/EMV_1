export const EXTRA_COST_KINDS = ["Логистика", "Иные затраты", "Билеты", "Проживание"] as const;
export const EXTRA_COST_STATUSES = ["Требуется оплата", "Оплачено", "Отменено"] as const;

export type ExtraCostLineInput = {
  kind: "GOODS" | "SERVICE";
  productId: string | null;
  serviceId: string | null;
  name: string;
  quantity: number;
  /** kopecks */
  price: number;
};

export type ExtraCostInput = {
  id: string | null;
  kind: string;
  number: string;
  /** yyyy-mm-dd */
  date: string;
  orderId: string | null;
  supplierId: string | null;
  status: string;
  note: string;
  /** kopecks; used when there are no lines */
  amount: number;
  lines: ExtraCostLineInput[];
};
