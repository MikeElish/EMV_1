import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatRub } from "@/lib/money";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { ProtectedImage } from "@/components/shop/ProtectedImage";

type Attributes = { machineType?: string; compatibleWith?: string[] } | null;

export default async function ProductPage({
  params,
}: PageProps<"/shop/product/[slug]">) {
  const { slug } = await params;

  const product = await prisma.product.findUnique({
    where: { slug },
    include: { category: true },
  });

  if (!product || !product.isActive) notFound();

  const attributes = product.attributes as Attributes;

  return (
    <section className="mx-auto max-w-4xl px-6 py-16">
      <nav className="text-sm text-foreground/50">
        <Link href="/shop" className="hover:underline">
          Каталог
        </Link>
        {" / "}
        <Link
          href={`/shop/categories/${product.category.slug}`}
          className="hover:underline"
        >
          {product.category.name}
        </Link>
      </nav>

      <div className="mt-6 grid gap-10 sm:grid-cols-2">
        <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-foreground/[0.03] text-sm text-foreground/30">
          {product.images.length > 0 ? (
            <ProtectedImage
              src={product.images[0]}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          ) : (
            "Фото скоро"
          )}
        </div>

        <div>
          {product.brand && (
            <span className="text-sm text-foreground/50">
              {product.brand}
              {attributes?.machineType ? ` · ${attributes.machineType}` : ""}
            </span>
          )}
          <h1 className="mt-1 text-2xl font-bold">{product.name}</h1>
          <p className="mt-1 text-sm text-foreground/40">
            Артикул: {product.sku}
          </p>

          <p className="mt-6 text-3xl font-semibold">
            {formatRub(product.price)}
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

          {product.description && (
            <p className="mt-6 text-foreground/80">{product.description}</p>
          )}

          {attributes?.compatibleWith && attributes.compatibleWith.length > 0 && (
            <div className="mt-6">
              <h2 className="text-sm font-medium text-foreground/50">
                Совместимо с
              </h2>
              <ul className="mt-1 text-sm">
                {attributes.compatibleWith.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
