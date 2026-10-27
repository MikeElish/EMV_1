import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { OfferPrice, ProductOffersBlock, ShopOffersProvider } from "@/components/shop/ShopOffers";
import { getShopOffers } from "@/lib/supplier-offers";
import { ProductGallery } from "@/components/shop/ProductGallery";
import { ShopLink } from "@/components/shop/ShopLink";
import { absoluteUrl, brandSlug, productHeading, productIntro, rubText, SHOP_CITY_IN, SHOP_NAME } from "@/lib/site";
import { formatShopPrice } from "@/lib/money";

type Attributes = { machineType?: string; compatibleWith?: string[] } | null;

// One query for the page and its <head>.
const getProduct = cache((slug: string) => prisma.product.findUnique({ where: { slug }, include: { category: true } }));

export async function generateMetadata({ params }: PageProps<"/shop/product/[slug]">): Promise<Metadata> {
  const product = await getProduct((await params).slug);
  if (!product || !product.isActive) return {};
  const heading = productHeading(product);
  const stock = product.stock > 0 ? "в наличии" : "под заказ";
  const description = [
    `${heading}: ${product.price > 0 ? `цена ${rubText(product.price)}` : "цена по запросу"}, ${stock}. Купить ${SHOP_CITY_IN} в ${SHOP_NAME}.`,
    product.description,
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 300);
  return {
    title: `${heading} — купить ${SHOP_CITY_IN}`,
    description,
    alternates: { canonical: `/shop/product/${product.slug}` },
    openGraph: { title: heading, description, url: `/shop/product/${product.slug}`, images: product.images.slice(0, 1) },
  };
}

export default async function ProductPage({ params }: PageProps<"/shop/product/[slug]">) {
  const { slug } = await params;

  const product = await getProduct(slug);

  if (!product || !product.isActive) notFound();

  const attributes = product.attributes as Attributes;

  const [offers, mainOffer, related] = await Promise.all([
    getShopOffers([product.id]),
    prisma.supplierOffer.findFirst({ where: { productId: product.id, selected: true }, select: { deliveryDays: true } }),
    relatedProducts(product),
  ]);
  const intro = productIntro({ ...product, categoryName: product.category.name, deliveryDays: mainOffer?.deliveryDays ?? null });
  const prices = [product.price, ...(offers[product.id] ?? []).map((o) => o.price)].filter((p) => p > 0);

  // schema.org Product: Яндекс and Google show the price and stock in the results.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: productHeading(product),
    sku: product.sku,
    mpn: product.sku,
    description: [intro, product.description].filter(Boolean).join(" "),
    category: product.category.name,
    image: product.images.length > 0 ? product.images.map((i) => absoluteUrl(i)) : undefined,
    brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
    // No price yet («По запросу»): no offer for the search engines.
    offers: prices.length === 0 ? undefined : {
      "@type": "AggregateOffer",
      priceCurrency: "RUB",
      lowPrice: (Math.min(...prices) / 100).toFixed(2),
      highPrice: (Math.max(...prices) / 100).toFixed(2),
      offerCount: prices.length,
      availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/BackOrder",
      url: absoluteUrl(`/shop/product/${product.slug}`),
      seller: { "@type": "Organization", name: SHOP_NAME },
    },
  };

  return (
    <ShopOffersProvider offers={offers}>
      <section className="mx-auto max-w-4xl px-4 sm:px-6 py-16">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
        <nav className="text-sm text-foreground/50">
          <Link href="/shop" className="hover:underline">
            Каталог
          </Link>
          {" / "}
          <ShopLink
            eager
            href={`/shop/categories/${product.category.slug}`}
            className="hover:underline"
          >
            {product.category.name}
          </ShopLink>
        </nav>

        <div className="mt-6 grid gap-10 sm:grid-cols-2">
          <ProductGallery images={product.images} alt={product.name} />

          <div>
            {product.brand && (
              <span className="text-sm text-foreground/50">
                {brandSlug(product.brand) ? (
                  <ShopLink href={`/shop/brands/${brandSlug(product.brand)}`} className="hover:underline">
                    {product.brand}
                  </ShopLink>
                ) : (
                  product.brand
                )}
                {attributes?.machineType ? ` · ${attributes.machineType}` : ""}
              </span>
            )}
            <h1 className="mt-1 text-2xl font-bold">{product.name}</h1>
            <p className="mt-1 text-sm text-foreground/40">Артикул: {product.sku}</p>

            <p className="mt-6 text-3xl font-semibold">
              <OfferPrice product={product} />
            </p>
            <p className="mt-2 text-sm">
              {product.stock > 0 ? (
                <span className="text-green-700 dark:text-green-500">
                  В наличии ({product.stock} шт.)
                </span>
              ) : (
                <span className="text-foreground/50">Под заказ</span>
              )}
            </p>

            <AddToCartButton
              product={{
                id: product.id,
                slug: product.slug,
                sku: product.sku,
                name: product.name,
                price: product.price,
                stock: product.stock,
              }}
            />
            <ProductOffersBlock product={product} />

            <p className="mt-6 text-foreground/80">{intro}</p>
            {product.description && (
              <p className="mt-3 text-foreground/80">{product.description}</p>
            )}

            {attributes?.compatibleWith && attributes.compatibleWith.length > 0 && (
              <div className="mt-6">
                <h2 className="text-sm font-medium text-foreground/50">Совместимо с</h2>
                <ul className="mt-1 text-sm">
                  {attributes.compatibleWith.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {related.length > 0 && (
          <div className="mt-12">
            <h2 className="text-lg font-semibold">
              {product.brand ? `Другие запчасти ${product.brand}` : "Другие запчасти"}: {product.category.name}
            </h2>
            <ul className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {related.map((p) => (
                <li key={p.slug} className="flex justify-between gap-3">
                  <ShopLink href={`/shop/product/${p.slug}`} className="truncate hover:underline">
                    {p.name} <span className="text-foreground/40">{p.sku}</span>
                  </ShopLink>
                  <span className="shrink-0 text-foreground/60">{formatShopPrice(p.price)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </ShopOffersProvider>
  );
}

/** Same brand and category first, then the rest of the category: internal links for the search engines and the customer. */
async function relatedProducts(product: { id: string; brand: string | null; categoryId: string }) {
  const select = { slug: true, name: true, sku: true, price: true } as const;
  const where = { isActive: true, categoryId: product.categoryId, id: { not: product.id } };
  const sameBrand = product.brand
    ? await prisma.product.findMany({ where: { ...where, brand: product.brand }, select, orderBy: [{ stock: "desc" }, { name: "asc" }], take: 8 })
    : [];
  if (sameBrand.length >= 8) return sameBrand;
  const rest = await prisma.product.findMany({
    where: { ...where, slug: { notIn: sameBrand.map((p) => p.slug) } },
    select,
    orderBy: [{ stock: "desc" }, { name: "asc" }],
    take: 8 - sameBrand.length,
  });
  return [...sameBrand, ...rest];
}
