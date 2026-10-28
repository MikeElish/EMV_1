import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ShopOffersProvider } from "@/components/shop/ShopOffers";
import { getShopOffers } from "@/lib/supplier-offers";
import { HeroMessageCarousel } from "@/components/shop/HeroMessageCarousel";
import { CategoryBrowser } from "@/components/shop/CategoryBrowser";
import { NewArrivalsRotator } from "@/components/shop/NewArrivalsRotator";
import { rotatorDirections } from "@/lib/shop-rotator";

export const metadata: Metadata = {
  alternates: { canonical: "/shop" },
};

export default async function ShopHomePage() {
  const [categories, allActiveProducts] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      include: { _count: { select: { products: { where: { isActive: true } } } } },
    }),
    // Full rows (not a narrow select) so the same records can be handed
    // straight to ProductQuickViewModal for the category browser's and the
    // "Новое поступление" rotator's popups.
    prisma.product.findMany({
      where: { isActive: true },
    }),
  ]);

  const browserCategories = categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    count: c._count.products,
  }));

  const offers = await getShopOffers(allActiveProducts.map((p) => p.id));

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
          <CategoryBrowser categories={browserCategories} products={allActiveProducts} />
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 pt-4 sm:px-6">
          <NewArrivalsRotator directions={rotatorDirections(allActiveProducts)} />
        </section>
      </>
    </ShopOffersProvider>
  );
}
