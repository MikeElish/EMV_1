import "server-only";
import { prisma } from "@/lib/prisma";
import { DEFAULT_MARKUPS, type Markups } from "@/lib/pricing";
import { DEFAULT_EXCHANGE_RATES, type ExchangeRates } from "@/lib/supplier-currency";

export async function getMarkups(): Promise<Markups> {
  const settings = await prisma.priceSettings.findUnique({ where: { id: 1 } });
  return settings
    ? {
        retailMarkup: settings.retailMarkup,
        wholesaleMarkup: settings.wholesaleMarkup,
        dealerMarkup: settings.dealerMarkup,
      }
    : DEFAULT_MARKUPS;
}

export async function getExchangeRates(): Promise<ExchangeRates> {
  const settings = await prisma.priceSettings.findUnique({ where: { id: 1 } });
  return settings
    ? {
        USD: settings.exchangeRateUsd,
        EUR: settings.exchangeRateEur,
        CNY: settings.exchangeRateCny,
      }
    : DEFAULT_EXCHANGE_RATES;
}

export async function getSuppliers() {
  return prisma.company.findMany({
    where: { type: { equals: "Поставщик", mode: "insensitive" } },
    select: { id: true, name: true, inn: true },
    orderBy: { name: "asc" },
  });
}
