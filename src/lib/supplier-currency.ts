export const SUPPLIER_CURRENCIES = ["RUB", "USD", "EUR", "CNY"] as const;
export type SupplierCurrency = (typeof SUPPLIER_CURRENCIES)[number];
export const MAX_MONEY_MINOR = 2_147_483_647;

export const SUPPLIER_CURRENCY_LABELS: Record<SupplierCurrency, string> = {
  RUB: "Рубли",
  USD: "Доллар США",
  EUR: "Евро",
  CNY: "Юань",
};

export type ExchangeRates = {
  USD: number;
  EUR: number;
  CNY: number;
};

export const DEFAULT_EXCHANGE_RATES: ExchangeRates = { USD: 0, EUR: 0, CNY: 0 };

export const SUPPLIER_CURRENCY_SYMBOLS: Record<SupplierCurrency, string> = {
  RUB: "₽",
  USD: "$",
  EUR: "€",
  CNY: "¥",
};

export function parseSupplierCurrency(value: unknown): SupplierCurrency | null {
  return typeof value === "string" && SUPPLIER_CURRENCIES.includes(value as SupplierCurrency)
    ? (value as SupplierCurrency)
    : null;
}

export function quotePriceInRub(
  priceMinor: number,
  currency: SupplierCurrency,
  exchangeRate: number | null,
  logisticsMarkupPercent: number,
): number | null {
  if (!Number.isSafeInteger(priceMinor) || priceMinor <= 0 || priceMinor > MAX_MONEY_MINOR) return null;
  if (currency === "RUB") return priceMinor;
  if (exchangeRate === null || !Number.isFinite(exchangeRate) || exchangeRate <= 0) return null;
  if (!Number.isFinite(logisticsMarkupPercent) || logisticsMarkupPercent < 0 || logisticsMarkupPercent > 1000) return null;
  const converted = Math.round(priceMinor * exchangeRate * (1 + logisticsMarkupPercent / 100));
  return Number.isSafeInteger(converted) && converted <= MAX_MONEY_MINOR ? converted : null;
}

export function formatSupplierCurrency(priceMinor: number, currency: SupplierCurrency): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(priceMinor / 100);
}
