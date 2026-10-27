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

/** A client company's price type (Company.priceType); WHOLESALE is the shop's own price. */
export type PriceTier = { type: "RETAIL" | "WHOLESALE" | "DEALER" | "INDIVIDUAL"; markup: number | null };

export const PRICE_TIER_LABELS: Record<PriceTier["type"], string> = {
  RETAIL: "Розница",
  WHOLESALE: "Опт",
  DEALER: "Дилер",
  INDIVIDUAL: "Индивидуальный",
};

/**
 * The product's price for a price type. «По запросу» (no price) stays so;
 * a type the product has no price for falls back to the shop price.
 */
export function tierPrice(
  product: { price: number; pricing: { purchasePrice: number; retailPrice: number; dealerPrice: number } | null },
  tier: PriceTier | null
): number {
  if (!tier || product.price <= 0) return product.price;
  const p = product.pricing;
  switch (tier.type) {
    case "RETAIL":
      return p && p.retailPrice > 0 ? p.retailPrice : product.price;
    case "DEALER":
      return p && p.dealerPrice > 0 ? p.dealerPrice : product.price;
    case "INDIVIDUAL":
      return p && p.purchasePrice > 0 && tier.markup !== null ? applyMarkup(p.purchasePrice, tier.markup) : product.price;
    default:
      return product.price;
  }
}

export function salePrices(purchase: number, markups: Markups) {
  return {
    retailPrice: applyMarkup(purchase, markups.retailMarkup),
    wholesalePrice: applyMarkup(purchase, markups.wholesaleMarkup),
    dealerPrice: applyMarkup(purchase, markups.dealerMarkup),
  };
}
