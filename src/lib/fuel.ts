import type { FuelType } from "@prisma/client";

export const FUEL_TYPES: FuelType[] = ["AI95", "AI92", "LPG"];

export const FUEL_LABELS: Record<FuelType, string> = {
  AI95: "АИ-95",
  AI92: "АИ-92",
  LPG: "СУГ",
};

/** НДС rates on a receipt; null = без НДС. */
export const VAT_RATES: (number | null)[] = [22, 10, 7, 5, 0, null];

export function vatLabel(rate: number | null) {
  return rate === null ? "Без НДС" : `${rate}%`;
}
