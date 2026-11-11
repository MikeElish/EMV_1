export type OrderPricingLine = {
  priceSnapshot: number;
  quantity: number;
  bonus?: number;
};

/** The line total in kopecks, including its whole-line bonus. */
export function orderLineTotal(line: OrderPricingLine): number {
  return line.priceSnapshot * line.quantity + (line.bonus ?? 0);
}

/**
 * Splits a whole-line bonus into unit prices that differ by at most one
 * kopeck, preserving the exact line total in documents.
 */
export function expandLineBonus<T extends { quantity: number; price: number; bonus?: number }>(line: T): Omit<T, "bonus">[] {
  const { bonus = 0, ...base } = line;
  if (!bonus) return [base];
  const perUnit = Math.floor(bonus / line.quantity);
  const remainder = bonus % line.quantity;
  const regularQuantity = line.quantity - remainder;
  return [
    ...(regularQuantity ? [{ ...base, quantity: regularQuantity, price: line.price + perUnit }] : []),
    ...(remainder ? [{ ...base, quantity: remainder, price: line.price + perUnit + 1 }] : []),
  ];
}

/** Average unit price for display; the line total remains exact in kopecks. */
export function orderLineUnitPrice(line: OrderPricingLine): number {
  return line.priceSnapshot + (line.bonus ?? 0) / line.quantity;
}

export function formatOrderLineUnitPrice(line: OrderPricingLine): string {
  return `${(orderLineUnitPrice(line) / 100).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  })} ₽`;
}
