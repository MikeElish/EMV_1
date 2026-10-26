import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/site";
import { getShopBrands } from "@/lib/shop-seo";

// Built on each request: new products show up without a deploy.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products, brands] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: true, products: { some: { isActive: true } } },
      select: { slug: true, updatedAt: true },
    }),
    prisma.product.findMany({
      where: { isActive: true, category: { isActive: true } },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
    getShopBrands(),
  ]);

  const page = (path: string, priority: number, lastModified?: Date): MetadataRoute.Sitemap[number] => ({
    url: absoluteUrl(path),
    lastModified,
    priority,
  });

  return [
    page("/", 0.5),
    page("/shop", 1, products[0]?.updatedAt),
    page("/shop/brands", 0.8),
    ...categories.map((c) => page(`/shop/categories/${c.slug}`, 0.8, c.updatedAt)),
    ...brands.map((b) => page(`/shop/brands/${b.slug}`, 0.7)),
    ...products.map((p) => page(`/shop/product/${p.slug}`, 0.6, p.updatedAt)),
    ...["/taxi", "/taxi/jobs", "/taxi/fleet", "/taxi/services", "/taxi/about", "/taxi/contacts"].map((p) => page(p, 0.4)),
  ];
}
