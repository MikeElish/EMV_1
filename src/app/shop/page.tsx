import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ShopOffersProvider } from "@/components/shop/ShopOffers";
import { getShopOffers } from "@/lib/supplier-offers";
import { HeroMessageCarousel } from "@/components/shop/HeroMessageCarousel";
import { CategoryBrowser } from "@/components/shop/CategoryBrowser";
import { NewArrivalsRotator } from "@/components/shop/NewArrivalsRotator";
import { rotatorDirections } from "@/lib/shop-rotator";
import type { ShopCatalogProduct } from "@/lib/shop-types";

export const metadata: Metadata = {
  alternates: { canonical: "/shop" },
};

const CATALOG_SELECT = {
  id: true,
  sku: true,
  name: true,
  slug: true,
  price: true,
  stock: true,
  partnerStock: true,
  brand: true,
  categoryId: true,
  newArrivalAt: true,
} satisfies Record<keyof ShopCatalogProduct, true>;

export default async function ShopHomePage() {
  const [categories, allActiveProducts] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      include: { _count: { select: { products: { where: { isActive: true } } } } },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      select: CATALOG_SELECT,
      orderBy: { name: "asc" },
    }),
  ]);

  const browserCategories = categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    count: c._count.products,
  }));

  const catalogProducts = allActiveProducts as unknown as ShopCatalogProduct[];
  const rotatorProducts = catalogProducts.slice(0, 200);

  const offers = await getShopOffers(catalogProducts.map((p) => p.id));

  return (
    <ShopOffersProvider offers={offers}>
      <>
        <section className="relative overflow-hidden">
          <video
            className="absolute inset-0 h-full w-full object-cover"
            src="/videos/shop-hero-reel.mp4"
            autoPlay
            muted
            loop
            playsInline
          />
          <div className="absolute inset-0 bg-black/55" />

          <div className="relative mx-auto flex min-h-[220px] max-w-6xl items-center px-4 pb-12 pt-36 sm:min-h-[240px] sm:px-6 sm:pb-16 sm:pt-32">
            <HeroMessageCarousel />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pt-2 sm:px-6">
          <CategoryBrowser categories={browserCategories} products={catalogProducts} />
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 pt-4 sm:px-6">
          <NewArrivalsRotator directions={rotatorDirections(rotatorProducts, { maxItems: 50 })} />
        </section>
      </>
    </ShopOffersProvider>
  );
}
