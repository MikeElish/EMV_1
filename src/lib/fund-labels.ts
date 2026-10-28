// The funds of Финансы → Фонды (src/lib/funds.ts); a payment request is paid from one.
export const FUNDS = ["VAT", "NDFL", "SALARY", "DEPRECIATION", "LEASING", "REPAIRS", "FREE"] as const;
export type Fund = (typeof FUNDS)[number];
export const FUND_LABELS: Record<Fund, string> = {
  VAT: "НДС 22%",
  NDFL: "НДФЛ",
  SALARY: "Зарплата",
  DEPRECIATION: "Амортизация и документы ТС",
  LEASING: "Лизинг",
  REPAIRS: "Ремонты",
  FREE: "Свободный остаток",
};
