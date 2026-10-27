import "server-only";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/session";
import { getShopOffers } from "@/lib/supplier-offers";
import { tierPrice, type PriceTier } from "@/lib/pricing";

/** A company's price type; null when it is the shop's own (Опт) or the markup isn't set. */
export function companyTier(company: { priceType: PriceTier["type"]; individualMarkup: number | null } | null): PriceTier | null {
  if (!company || company.priceType === "WHOLESALE") return null;
  if (company.priceType === "INDIVIDUAL" && company.individualMarkup === null) return null;
  return { type: company.priceType, markup: company.individualMarkup };
}

/** The signed-in Покупатель's company price type; null for guests, staff and Опт. */
export async function sessionPriceTier(): Promise<PriceTier | null> {
  const session = await getAdminSession();
  if (session?.role !== "CUSTOMER") return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { company: { select: { priceType: true, individualMarkup: true } } },
  });
  return companyTier(user?.company ?? null);
}

export type CustomerPrices = Record<string, { price: number; offers: Record<string, number> }>;

/** The products' prices and their offers' prices for a price type. */
export async function customerPrices(productIds: string[], tier: PriceTier): Promise<CustomerPrices> {
  const [products, offers] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, price: true, pricing: { select: { purchasePrice: true, retailPrice: true, dealerPrice: true } } },
    }),
    getShopOffers(productIds, tier),
  ]);
  return Object.fromEntries(
    products.map((p) => [
      p.id,
      { price: tierPrice(p, tier), offers: Object.fromEntries((offers[p.id] ?? []).map((o) => [o.id, o.price])) },
    ])
  );
}
