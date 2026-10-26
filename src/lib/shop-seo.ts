import { prisma } from "@/lib/prisma";
import { brandSlug } from "@/lib/site";

export type ShopBrand = { name: string; slug: string; count: number };

/** Brands that have products on sale, each with its page slug (A→Z). */
export async function getShopBrands(): Promise<ShopBrand[]> {
  const rows = await prisma.product.groupBy({
    by: ["brand"],
    where: { isActive: true, brand: { not: null }, category: { isActive: true } },
    _count: true,
  });
  const bySlug = new Map<string, ShopBrand>();
  for (const row of rows) {
    const name = row.brand!.trim();
    const slug = brandSlug(name);
    if (!name || !slug) continue;
    const existing = bySlug.get(slug);
    // Two spellings of one slug share the page; the bigger one names it.
    if (existing) {
      if (row._count > existing.count) existing.name = name;
      existing.count += row._count;
    } else bySlug.set(slug, { name, slug, count: row._count });
  }
  return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

/** The brand spellings behind a page slug (usually one). */
export async function brandNamesForSlug(slug: string): Promise<string[]> {
  const rows = await prisma.product.findMany({
    where: { isActive: true, brand: { not: null } },
    distinct: ["brand"],
    select: { brand: true },
  });
  return rows.map((r) => r.brand!).filter((b) => brandSlug(b.trim()) === slug);
}
