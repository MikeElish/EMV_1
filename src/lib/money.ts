const formatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

const preciseFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** price/stock amounts are stored in kopecks (minor units) to avoid float rounding errors */
export function formatRub(minorUnits: number): string {
  return formatter.format(minorUnits / 100);
}

/** Same as formatRub, but always shows exactly 2 decimal places (e.g. for VAT breakdowns). */
export function formatRubPrecise(minorUnits: number): string {
  return preciseFormatter.format(minorUnits / 100);
}

/**
 * Converts a ruble amount (as typed by an admin, or read from an import
 * sheet) to kopecks, always rounding up rather than to the nearest kopeck.
 * The tiny epsilon subtraction guards against float multiplication
 * artifacts (e.g. 1.1 * 100 === 110.00000000000001), which would otherwise
 * round up an extra kopeck for perfectly round prices.
 */
export function rublesToKopecksRoundedUp(rubles: number): number {
  return Math.ceil(rubles * 100 - 1e-9);
}
