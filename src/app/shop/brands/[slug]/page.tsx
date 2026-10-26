import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProductGrid } from "@/components/shop/ProductGrid";
import { ShopLink } from "@/components/shop/ShopLink";
import { ShopOffersProvider } from "@/components/shop/ShopOffers";
import { getShopOffers } from "@/lib/supplier-offers";
import { brandNamesForSlug } from "@/lib/shop-seo";
import { positions, SHOP_CITY_IN, SHOP_NAME } from "@/lib/site";

// One query for the page and its <head>.
const getBrand = cache(async (slug: string) => {
  const names = await brandNamesForSlug(slug);
  if (names.length === 0) return null;
  const products = await prisma.product.findMany({
    where: { isActive: true, brand: { in: names }, category: { isActive: true } },
    include: { category: true },
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
  });
  if (products.length === 0) return null;
  // The spelling most products use names the page.
  const counts = new Map<string, number>();
  for (const p of products) counts.set(p.brand!, (counts.get(p.brand!) ?? 0) + 1);
  const name = [...counts].sort((a, b) => b[1] - a[1])[0][0];
  return { name, products };
});

/** «Фильтры» → «фильтры» in a sentence; «ДВС» stays as it is. */
const lowerFirst = (name: string) =>
  name
    .split(" / ")
    .map((word) => (/^.\p{Lu}/u.test(word) ? word : word[0].toLowerCase() + word.slice(1)))
    .join(" / ");

export async function generateMetadata({ params }: PageProps<"/shop/brands/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const brand = await getBrand(slug);
  if (!brand) return {};
  const categories = [...new Set(brand.products.map((p) => lowerFirst(p.category.name)))].slice(0, 5).join(", ");
  return {
    title: `Запчасти ${brand.name} — купить ${SHOP_CITY_IN}`,
    description: `Запчасти для техники ${brand.name}: ${positions(brand.products.length)} — ${categories}. Подбор по артикулу, прямые поставки, цены на сайте ${SHOP_NAME}.`,
    alternates: { canonical: `/shop/brands/${slug}` },
  };
}

export default async function BrandPage({ params }: PageProps<"/shop/brands/[slug]">) {
  const { slug } = await params;
  const brand = await getBrand(slug);
  if (!brand) notFound();

  const categories = new Map<string, { name: string; slug: string; count: number }>();
  for (const p of brand.products) {
    const c = categories.get(p.category.slug) ?? { name: p.category.name, slug: p.category.slug, count: 0 };
    c.count += 1;
    categories.set(p.category.slug, c);
  }

  const { products } = brand;
  const offers = await getShopOffers(products.map((p) => p.id));

  return (
    <ShopOffersProvider offers={offers}>
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <nav className="text-sm text-foreground/50">
          <Link href="/shop" className="hover:underline">
            Каталог
          </Link>
          {" / "}
          <ShopLink href="/shop/brands" className="hover:underline">
            Бренды
          </ShopLink>
        </nav>
        <h1 className="mt-4 text-3xl font-bold">Запчасти {brand.name}</h1>
        <p className="mt-3 max-w-2xl text-foreground/70">
          {positions(products.length)} для техники {brand.name}. Если нужной детали нет в списке — найдите её по артикулу
          в поиске или напишите нам, подберём и привезём под заказ.
        </p>

        <div className="mt-6 flex flex-wrap gap-2 text-sm">
          {[...categories.values()].map((c) => (
            <ShopLink
              key={c.slug}
              href={`/shop/categories/${c.slug}?brand=${encodeURIComponent(brand.name)}`}
              className="rounded-full border border-foreground/15 px-3 py-1 text-foreground/70 hover:border-foreground/40 hover:text-foreground"
            >
              {c.name} <span className="text-foreground/40">{c.count}</span>
            </ShopLink>
          ))}
        </div>

        <div className="mt-8">
          <ProductGrid products={products} />
        </div>
      </section>
    </ShopOffersProvider>
  );
}
