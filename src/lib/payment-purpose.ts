import type { PaymentPurposeCategory } from "@prisma/client";

export const PAYMENT_PURPOSE_CATEGORIES: PaymentPurposeCategory[] = [
  "GOODS",
  "SERVICES",
  "DELIVERY",
  "RENT",
  "BONUSES",
  "OTHER",
  "SALARY",
];

export const PAYMENT_PURPOSE_LABELS: Record<PaymentPurposeCategory, string> = {
  GOODS: "Товар",
  SERVICES: "Услуги",
  DELIVERY: "Доставка",
  RENT: "Аренда",
  BONUSES: "Бонусы",
  OTHER: "Иное",
  SALARY: "Зарплата",
};

export function purposeCategoryForExtraCost(kind: string): PaymentPurposeCategory {
  const value = kind.toLocaleLowerCase("ru");
  if (value.includes("достав") || value.includes("логист")) return "DELIVERY";
  if (value.includes("аренд")) return "RENT";
  if (value.includes("услуг")) return "SERVICES";
  return "OTHER";
}
