import type { Metadata } from "next";
import Link from "next/link";
import { ShopLink } from "@/components/shop/ShopLink";
import { getShopBrands } from "@/lib/shop-seo";
import { SHOP_CITY_IN } from "@/lib/site";

// The list is built at deploy; refreshed hourly so new brands appear by themselves.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: `Бренды запчастей для спецтехники — купить ${SHOP_CITY_IN}`,
  description:
    "Запчасти по производителям техники: JUNGHEINRICH, SDLG, VOLVO, KOMATSU, CATERPILLAR, HYUNDAI и другие. Подбор по артикулу, прямые поставки.",
  alternates: { canonical: "/shop/brands" },
};

export default async function BrandsPage() {
  const brands = await getShopBrands();

  // Grouped by the first letter, like an index at the back of a book.
  const groups = new Map<string, typeof brands>();
  for (const brand of brands) {
    const letter = /^[0-9]/.test(brand.name) ? "0–9" : brand.name[0].toUpperCase();
    groups.set(letter, [...(groups.get(letter) ?? []), brand]);
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <nav className="text-sm text-foreground/50">
        <Link href="/shop" className="hover:underline">
          Каталог
        </Link>
        {" / "}Бренды
      </nav>
      <h1 className="mt-4 text-3xl font-bold">Бренды</h1>
      <p className="mt-3 max-w-2xl text-foreground/70">
        Запчасти для спецтехники {brands.length} производителей. Выберите бренд, чтобы увидеть все позиции в каталоге.
      </p>

      <div className="mt-10 columns-2 gap-8 sm:columns-3 lg:columns-4">
        {[...groups].map(([letter, items]) => (
          <div key={letter} className="mb-6 break-inside-avoid">
            <h2 className="mb-1 text-sm font-semibold text-foreground/40">{letter}</h2>
            <ul className="space-y-1">
              {items.map((b) => (
                <li key={b.slug}>
                  <ShopLink href={`/shop/brands/${b.slug}`} className="hover:underline">
                    {b.name}
                  </ShopLink>{" "}
                  <span className="text-xs text-foreground/40">{b.count}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
