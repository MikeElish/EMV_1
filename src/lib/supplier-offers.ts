import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMarkups } from "@/lib/price-settings";
import { applyMarkup, markupOf, tierPrice, type Markups, type PriceTier } from "@/lib/pricing";

type Db = Prisma.TransactionClient | typeof prisma;
type OfferPricing = {
  currency?: string;
  quotedPrice?: number;
  exchangeRate?: number | null;
  logisticsMarkupPercent?: number;
  inStock?: boolean;
  stockQuantity?: number | null;
};

/** Makes `offerId` the product's selected offer (the one behind the site prices). */
export async function selectOffer(db: Db, productId: string, offerId: string) {
  const offer = await db.supplierOffer.findFirst({ where: { id: offerId, productId, noOffer: false, price: { gt: 0 } } });
  if (!offer) throw new Error("Нельзя выбрать предложение без цены");
  await db.supplierOffer.updateMany({ where: { productId, NOT: { id: offerId } }, data: { selected: false } });
  return db.supplierOffer.update({ where: { id: offerId }, data: { selected: true } });
}

/**
 * A price for the product from this supplier (an import of new products):
 * updates that supplier's offer or adds one, and selects it.
 */
export async function recordOffer(
  db: Db,
  productId: string,
  offer: { supplierId: string | null; price: number; deliveryDays?: number | null; quality?: string | null; warehouse?: string | null } & OfferPricing
) {
  const saved = await upsertSupplierOffer(db, productId, {
    ...offer,
    currency: offer.currency ?? "RUB",
    quotedPrice: offer.quotedPrice ?? offer.price,
    exchangeRate: offer.exchangeRate ?? 1,
    logisticsMarkupPercent: offer.logisticsMarkupPercent ?? 0,
  });
  return selectOffer(db, productId, saved.id);
}

/**
 * Adds or updates the offer of one supplier (Проценка, its Excel upload).
 * «Дата обновления» moves only when the price or the delivery time change.
 * The selection is left alone -- except that a product without a selected
 * offer gets this one.
 */
export async function upsertSupplierOffer(
  db: Db,
  productId: string,
  offer: { supplierId: string | null; price: number; deliveryDays?: number | null; quality?: string | null; warehouse?: string | null } & OfferPricing,
  { selectIfNone = true }: { selectIfNone?: boolean } = {}
) {
  const existing = await db.supplierOffer.findFirst({
    where: { productId, supplierId: offer.supplierId },
    orderBy: { priceUpdatedAt: "desc" },
  });
  const deliveryDays = offer.deliveryDays === undefined ? existing?.deliveryDays ?? null : offer.deliveryDays;
  const quality = offer.quality === undefined ? existing?.quality ?? null : offer.quality;
  const warehouse = offer.warehouse === undefined ? existing?.warehouse ?? null : offer.warehouse;
  const currency = offer.currency ?? existing?.currency ?? "RUB";
  const quotedPrice = offer.quotedPrice ?? offer.price;
  const exchangeRate = offer.exchangeRate === undefined ? existing?.exchangeRate ?? 1 : offer.exchangeRate;
  const logisticsMarkupPercent = offer.logisticsMarkupPercent ?? existing?.logisticsMarkupPercent ?? 0;
  const inStock = offer.inStock === undefined ? existing?.inStock ?? false : offer.inStock;
  const stockQuantity = offer.stockQuantity === undefined ? existing?.stockQuantity ?? null : offer.stockQuantity;
  const saved = existing
    ? await db.supplierOffer.update({
        where: { id: existing.id },
        data: {
          price: offer.price,
          quotedPrice,
          currency,
          exchangeRate,
          logisticsMarkupPercent,
          noOffer: false,
          inStock,
          stockQuantity,
          deliveryDays,
          quality,
          warehouse,
          ...(existing.price !== offer.price ||
          existing.quotedPrice !== quotedPrice ||
          existing.currency !== currency ||
          existing.exchangeRate !== exchangeRate ||
          existing.logisticsMarkupPercent !== logisticsMarkupPercent ||
          existing.deliveryDays !== deliveryDays ||
          existing.inStock !== inStock ||
          existing.stockQuantity !== stockQuantity
            ? { priceUpdatedAt: new Date() }
            : {}),
        },
      })
    : await db.supplierOffer.create({
        data: {
          productId,
          supplierId: offer.supplierId,
          price: offer.price,
          quotedPrice,
          currency,
          exchangeRate,
          logisticsMarkupPercent,
          inStock,
          stockQuantity,
          deliveryDays,
          quality,
          warehouse,
          noOffer: false,
        },
      });
  if (saved.price <= 0 && existing?.selected) {
    await db.supplierOffer.update({ where: { id: saved.id }, data: { selected: false } });
    const fallback = await db.supplierOffer.findFirst({
      where: { productId, noOffer: false, price: { gt: 0 } },
      orderBy: [{ priceUpdatedAt: "desc" }, { createdAt: "desc" }],
    });
    if (fallback) {
      await selectOffer(db, productId, fallback.id);
      await syncSelectedOffer(db, productId);
    }
  }
  const hasSelected = await db.supplierOffer.count({ where: { productId, selected: true, price: { gt: 0 } } });
  return hasSelected || !selectIfNone || saved.price <= 0 ? saved : selectOffer(db, productId, saved.id);
}

/**
 * The selected offer's price changed (or another offer was selected): the
 * purchase price follows it and the sale prices move with it, keeping each
 * markup %. A product without a purchase price yet gets the default markups.
 */
export async function syncSelectedOffer(db: Db, productId: string) {
  const [selected, pricing, product] = await Promise.all([
    db.supplierOffer.findFirst({ where: { productId, selected: true, noOffer: false, price: { gt: 0 } } }),
    db.productPricing.findUnique({ where: { productId } }),
    db.product.findUnique({ where: { id: productId }, select: { price: true } }),
  ]);
  if (!selected || !product) return;
  if (pricing && pricing.purchasePrice === selected.price && pricing.supplierId === selected.supplierId) return;

  const defaults = await getMarkups();
  const old = pricing?.purchasePrice ?? 0;
  const keep = (price: number, fallback: number) => (old > 0 && price > 0 ? markupOf(old, price) : fallback);
  const markups: Markups = {
    retailMarkup: keep(pricing?.retailPrice ?? 0, defaults.retailMarkup),
    wholesaleMarkup: keep(product.price, defaults.wholesaleMarkup),
    dealerMarkup: keep(pricing?.dealerPrice ?? 0, defaults.dealerMarkup),
  };
  const data = {
    purchasePrice: selected.price,
    supplierId: selected.supplierId,
    retailPrice: applyMarkup(selected.price, markups.retailMarkup),
    dealerPrice: applyMarkup(selected.price, markups.dealerMarkup),
  };
  await db.productPricing.upsert({ where: { productId }, create: { productId, ...data }, update: data });
  await db.product.update({
    where: { id: productId },
    data: { price: applyMarkup(selected.price, markups.wholesaleMarkup) },
  });
}

/** Records a supplier's refusal and keeps site pricing on an available offer, or on request. */
export async function markSupplierOfferNoOffer(db: Db, productId: string, supplierId: string) {
  const existing = await db.supplierOffer.findFirst({ where: { productId, supplierId }, orderBy: { priceUpdatedAt: "desc" } });
  if (existing) {
    await db.supplierOffer.updateMany({
      where: { productId, supplierId },
      data: { noOffer: true, selected: false },
    });
  } else {
    await db.supplierOffer.create({
      data: { productId, supplierId, price: 0, noOffer: true },
    });
  }

  const selected = await db.supplierOffer.findFirst({ where: { productId, selected: true, noOffer: false, price: { gt: 0 } } });
  if (selected) return;

  const fallback = await db.supplierOffer.findFirst({
    where: { productId, noOffer: false, price: { gt: 0 } },
    orderBy: [{ priceUpdatedAt: "desc" }, { createdAt: "desc" }],
  });
  if (fallback) {
    await selectOffer(db, productId, fallback.id);
    await syncSelectedOffer(db, productId);
    return;
  }

  await db.supplierOffer.updateMany({ where: { productId }, data: { selected: false } });
  const noPrice = { purchasePrice: 0, retailPrice: 0, dealerPrice: 0, supplierId: null };
  await db.productPricing.upsert({
    where: { productId },
    create: { productId, ...noPrice },
    update: noPrice,
  });
  await db.product.update({ where: { id: productId }, data: { price: 0 } });
}

import type { ShopOffer } from "@/lib/shop-offer";
export type { ShopOffer };

/**
 * Offers of products that have more than one, priced for the site: the
 * selected offer at the product's own price, the others with the same
 * markup over their purchase price. With a client company's price type
 * (`tier`) «the product's own price» is that type's price.
 */
export async function getShopOffers(productIds: string[], tier: PriceTier | null = null): Promise<Record<string, ShopOffer[]>> {
  if (!productIds.length) return {};
  const [offers, pricing, products, defaults] = await Promise.all([
    prisma.supplierOffer.findMany({
      where: { productId: { in: productIds }, noOffer: false, price: { gt: 0 } },
      select: { id: true, productId: true, price: true, deliveryDays: true, quality: true, selected: true },
    }),
    prisma.productPricing.findMany({
      where: { productId: { in: productIds } },
      select: { productId: true, purchasePrice: true, retailPrice: true, dealerPrice: true },
    }),
    prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, price: true } }),
    getMarkups(),
  ]);
  const pricingOf = new Map(pricing.map((p) => [p.productId, p]));
  const purchaseOf = new Map(pricing.map((p) => [p.productId, p.purchasePrice]));
  const priceOf = new Map(products.map((p) => [p.id, tierPrice({ price: p.price, pricing: pricingOf.get(p.id) ?? null }, tier)]));
  const byProduct = new Map<string, typeof offers>();
  for (const o of offers) byProduct.set(o.productId, [...(byProduct.get(o.productId) ?? []), o]);

  const result: Record<string, ShopOffer[]> = {};
  for (const [productId, list] of byProduct) {
    if (list.length < 2) continue;
    const sitePrice = priceOf.get(productId) ?? 0;
    const purchase = purchaseOf.get(productId) ?? 0;
    const markup = purchase > 0 && sitePrice > 0 ? markupOf(purchase, sitePrice) : defaults.wholesaleMarkup;
    result[productId] = list
      .map((o) => ({
        id: o.id,
        quality: o.quality,
        price: o.selected ? sitePrice : applyMarkup(o.price, markup),
        deliveryDays: o.deliveryDays,
        main: o.selected,
      }))
      .filter((o) => o.price > 0)
      .sort((a, b) => a.price - b.price);
    if (result[productId].length < 2) delete result[productId];
  }
  return result;
}

/** Site price of one offer -- what the cart and the order are charged. */
export async function shopOfferPrice(productId: string, offerId: string, tier: PriceTier | null = null): Promise<number | null> {
  const offers = await getShopOffers([productId], tier);
  return offers[productId]?.find((o) => o.id === offerId)?.price ?? null;
}
