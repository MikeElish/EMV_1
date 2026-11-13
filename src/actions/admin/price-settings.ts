"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { accessDenied } from "@/lib/access-server";
import { getMarkups } from "@/lib/price-settings";
import type { Markups } from "@/lib/pricing";
import type { ExchangeRates } from "@/lib/supplier-currency";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

const markup = z.coerce.number().min(0, "Наценка не может быть отрицательной").max(1000, "Слишком большая наценка");
const markupsSchema = z.object({ retailMarkup: markup, wholesaleMarkup: markup, dealerMarkup: markup });
const rate = z.coerce.number().min(0, "Курс не может быть отрицательным").max(1_000_000, "Слишком большой курс");
const exchangeRatesSchema = z.object({ USD: rate, EUR: rate, CNY: rate });

function revalidatePrices() {
  revalidatePath("/admin/settings/prices");
  revalidatePath("/admin/crm/products");
  revalidatePath("/shop", "layout");
}

export async function savePriceSettings(input: { markups: Markups; exchangeRates: ExchangeRates }): Promise<ActionResult> {
  const denied = await accessDenied("settings.prices");
  if (denied) return denied;

  const parsedMarkups = markupsSchema.safeParse(input.markups);
  if (!parsedMarkups.success) {
    return { ok: false, error: parsedMarkups.error.issues[0]?.message ?? "Некорректные данные" };
  }
  const parsedRates = exchangeRatesSchema.safeParse(input.exchangeRates);
  if (!parsedRates.success) {
    return { ok: false, error: parsedRates.error.issues[0]?.message ?? "Некорректные данные" };
  }

  await prisma.priceSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      ...parsedMarkups.data,
      exchangeRateUsd: parsedRates.data.USD,
      exchangeRateEur: parsedRates.data.EUR,
      exchangeRateCny: parsedRates.data.CNY,
    },
    update: {
      ...parsedMarkups.data,
      exchangeRateUsd: parsedRates.data.USD,
      exchangeRateEur: parsedRates.data.EUR,
      exchangeRateCny: parsedRates.data.CNY,
    },
  });

  revalidatePath("/admin/settings/prices");
  return { ok: true, message: "Настройки цен сохранены" };
}

/** Re-derives every product's sale prices from its purchase price and the current base markups. */
export async function recalculateAllPrices(): Promise<ActionResult> {
  const denied = await accessDenied("settings.prices");
  if (denied) return denied;

  const { retailMarkup, wholesaleMarkup, dealerMarkup } = await getMarkups();
  const factor = (pct: number) => 1 + pct / 100;

  const [, updated] = await prisma.$transaction([
    prisma.$executeRaw`
      UPDATE "ProductPricing"
      SET "retailPrice" = CEIL("purchasePrice" * ${factor(retailMarkup)}::numeric)::int,
          "dealerPrice" = CEIL("purchasePrice" * ${factor(dealerMarkup)}::numeric)::int`,
    prisma.$executeRaw`
      UPDATE "Product" p
      SET "price" = CEIL(pp."purchasePrice" * ${factor(wholesaleMarkup)}::numeric)::int
      FROM "ProductPricing" pp
      WHERE pp."productId" = p."id"`,
  ]);

  revalidatePrices();
  return { ok: true, message: `Цены пересчитаны у ${updated} товаров` };
}
