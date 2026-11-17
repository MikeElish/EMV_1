import { prisma } from "@/lib/prisma";

export type ShopBrand = { name: string; slug: string; count: number };

/** Brands marked as active, each with its page slug (A→Z). */
export async function getShopBrands(): Promise<ShopBrand[]> {
  const [brands, counts] = await Promise.all([
    prisma.brand.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.product.groupBy({
      by: ["brand"],
      where: { isActive: true, brand: { not: null }, category: { isActive: true } },
      _count: true,
    }),
  ]);
  const countByName = new Map(counts.map((c) => [c.brand ?? "", c._count]));
  return brands
    .map((b) => ({ name: b.name, slug: b.slug, count: countByName.get(b.name) ?? 0 }))
    .filter((b) => b.count > 0);
}

/** The brand name behind a page slug. */
export async function brandNamesForSlug(slug: string): Promise<string[]> {
  const brand = await prisma.brand.findUnique({ where: { slug } });
  return brand ? [brand.name] : [];
}
