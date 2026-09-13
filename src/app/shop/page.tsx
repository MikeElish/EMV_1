import { prisma } from "@/lib/prisma";
import { HeroMessageCarousel } from "@/components/shop/HeroMessageCarousel";
import { CategoryBrowser } from "@/components/shop/CategoryBrowser";
import { NewArrivalsRotator } from "@/components/shop/NewArrivalsRotator";

export default async function ShopHomePage() {
  const [categories, allActiveProducts] = await Promise.all([
    prisma.category.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } },
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

  const inStockPool = allActiveProducts.filter((p) => p.stock > 0);
  const readyToOfferPool = allActiveProducts.filter((p) => p.stock <= 0);
  const lastUploadAt = allActiveProducts.reduce<Date | null>(
    (max, p) => (!max || p.newArrivalAt > max ? p.newArrivalAt : max),
    null
  );
  const newArrivalsPool = lastUploadAt
    ? inStockPool.filter((p) => p.newArrivalAt.getTime() === lastUploadAt.getTime())
    : [];

  return (
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

        <div className="relative mx-auto flex min-h-[220px] max-w-6xl items-center px-6 pb-16 pt-28 sm:min-h-[240px] sm:pt-32">
          <HeroMessageCarousel />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pt-2">
        <CategoryBrowser categories={browserCategories} products={allActiveProducts} />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-4">
        <NewArrivalsRotator
          directions={[
            { key: "inStock", label: "В наличии", items: inStockPool },
            { key: "readyToOffer", label: "Готовы предложить", items: readyToOfferPool },
            { key: "newArrivals", label: "Новое поступление", items: newArrivalsPool },
          ]}
        />
      </section>
    </>
  );
}
