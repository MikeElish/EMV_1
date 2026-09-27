// Shared by the product card (client) and the server actions, so the
// "% ↔ price" math is identical on both sides. Amounts are in kopecks.

export type Markups = { retailMarkup: number; wholesaleMarkup: number; dealerMarkup: number };

export const DEFAULT_MARKUPS: Markups = { retailMarkup: 30, wholesaleMarkup: 20, dealerMarkup: 15 };

/** Sale price = purchase + markup%, rounded up to the kopeck (never below the markup). */
export function applyMarkup(purchase: number, markupPercent: number): number {
  return Math.ceil(purchase * (1 + markupPercent / 100) - 1e-9);
}

/** Markup % a given sale price represents over the purchase price, to 2 decimals. */
export function markupOf(purchase: number, price: number): number {
  if (purchase <= 0) return 0;
  return Math.round((price / purchase - 1) * 10000) / 100;
}

export function salePrices(purchase: number, markups: Markups) {
  return {
    retailPrice: applyMarkup(purchase, markups.retailMarkup),
    wholesalePrice: applyMarkup(purchase, markups.wholesaleMarkup),
    dealerPrice: applyMarkup(purchase, markups.dealerMarkup),
  };
}
