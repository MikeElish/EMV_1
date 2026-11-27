import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/site";

// Built on each request: new products show up without a deploy.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products, brands, brandCounts] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: true, products: { some: { isActive: true } } },
      select: { slug: true, updatedAt: true },
    }),
    prisma.product.findMany({
      where: { isActive: true, category: { isActive: true } },
      select: { slug: true, updatedAt: true, images: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.brand.findMany({
      where: { isActive: true },
      select: { name: true, slug: true, updatedAt: true },
      orderBy: { name: "asc" },
    }),
    prisma.product.groupBy({
      by: ["brand"],
      where: { isActive: true, brand: { not: null }, category: { isActive: true } },
      _count: true,
    }),
  ]);

  const countByName = new Map(brandCounts.map((c) => [c.brand ?? "", c._count]));
  const activeBrands = brands
    .filter((b) => (countByName.get(b.name) ?? 0) > 0)
    .map((b) => ({ slug: b.slug, updatedAt: b.updatedAt }));

  const globalLastMod = products[0]?.updatedAt ?? categories[0]?.updatedAt ?? activeBrands[0]?.updatedAt;
  const brandsIndexLastMod = activeBrands.reduce<Date | undefined>(
    (max, b) => (!max || b.updatedAt > max ? b.updatedAt : max),
    undefined,
  );

  const page = (
    path: string,
    priority: number,
    lastModified?: Date,
    images?: string[],
  ): MetadataRoute.Sitemap[number] => ({
    url: absoluteUrl(path),
    lastModified,
    priority,
    images,
  });

  return [
    page("/", 0.5, globalLastMod),
    page("/shop", 1, products[0]?.updatedAt),
    page("/shop/brands", 0.8, brandsIndexLastMod),
    ...categories.map((c) => page(`/shop/categories/${c.slug}`, 0.8, c.updatedAt)),
    ...activeBrands.map((b) => page(`/shop/brands/${b.slug}`, 0.7, b.updatedAt)),
    ...products.map((p) =>
      page(
        `/shop/product/${p.slug}`,
        0.6,
        p.updatedAt,
        p.images.length > 0 ? p.images.slice(0, 1).map((src) => absoluteUrl(src)) : undefined,
      ),
    ),
    ...["/taxi", "/taxi/jobs", "/taxi/fleet", "/taxi/services", "/taxi/about", "/taxi/contacts"].map((p) =>
      page(p, 0.4, globalLastMod),
    ),
  ];
}
