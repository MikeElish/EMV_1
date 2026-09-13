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
