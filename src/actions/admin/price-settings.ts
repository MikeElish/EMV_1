"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-dal";
import { getMarkups } from "@/lib/price-settings";
import type { Markups } from "@/lib/pricing";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

const markup = z.coerce.number().min(0, "Наценка не может быть отрицательной").max(1000, "Слишком большая наценка");
const markupsSchema = z.object({ retailMarkup: markup, wholesaleMarkup: markup, dealerMarkup: markup });

function revalidatePrices() {
  revalidatePath("/admin/settings/prices");
  revalidatePath("/admin/crm/products");
  revalidatePath("/shop", "layout");
}

export async function savePriceSettings(input: Markups): Promise<ActionResult> {
  await verifyAdminSession();

  const parsed = markupsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  await prisma.priceSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...parsed.data },
    update: parsed.data,
  });

  revalidatePath("/admin/settings/prices");
  return { ok: true, message: "Наценки сохранены" };
}

/** Re-derives every product's sale prices from its purchase price and the current base markups. */
export async function recalculateAllPrices(): Promise<ActionResult> {
  await verifyAdminSession();

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
