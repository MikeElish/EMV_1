import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProductGrid } from "@/components/shop/ProductGrid";
import Link from "next/link";

type Attributes = { machineType?: string } | null;

export default async function CategoryPage({
  params,
  searchParams,
}: PageProps<"/shop/categories/[slug]">) {
  const { slug } = await params;
  const query = await searchParams;

  const category = await prisma.category.findUnique({ where: { slug } });
  if (!category) notFound();

  const allProducts = await prisma.product.findMany({
    where: { categoryId: category.id, isActive: true },
    orderBy: { createdAt: "desc" },
  });

  const brand = typeof query.brand === "string" ? query.brand : undefined;
  const machineType =
    typeof query.machineType === "string" ? query.machineType : undefined;
  const sort = typeof query.sort === "string" ? query.sort : undefined;

  const brands = Array.from(
    new Set(allProducts.map((p) => p.brand).filter((b): b is string => !!b))
  ).sort();
  const machineTypes = Array.from(
    new Set(
      allProducts
        .map((p) => (p.attributes as Attributes)?.machineType)
        .filter((m): m is string => !!m)
    )
  ).sort();

  let products = allProducts.filter((p) => {
    if (brand && p.brand !== brand) return false;
    if (
      machineType &&
      (p.attributes as Attributes)?.machineType !== machineType
    )
      return false;
    return true;
  });

  if (sort === "price_asc") products = [...products].sort((a, b) => a.price - b.price);
  if (sort === "price_desc") products = [...products].sort((a, b) => b.price - a.price);

  function filterHref(next: { brand?: string; machineType?: string; sort?: string }) {
    const params = new URLSearchParams();
    const merged = { brand, machineType, sort, ...next };
    if (merged.brand) params.set("brand", merged.brand);
    if (merged.machineType) params.set("machineType", merged.machineType);
    if (merged.sort) params.set("sort", merged.sort);
    const qs = params.toString();
    return `/shop/categories/${slug}${qs ? `?${qs}` : ""}`;
  }

  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="text-3xl font-bold">{category.name}</h1>

      <div className="mt-6 flex flex-wrap gap-6 text-sm">
        {brands.length > 0 && (
          <div>
            <span className="text-foreground/50">Бренд: </span>
            <Link
              href={filterHref({ brand: undefined })}
              className={!brand ? "font-semibold underline" : "text-foreground/70"}
            >
              Все
            </Link>
            {brands.map((b) => (
              <span key={b}>
                {" · "}
                <Link
                  href={filterHref({ brand: b })}
                  className={
                    brand === b ? "font-semibold underline" : "text-foreground/70"
                  }
                >
                  {b}
                </Link>
              </span>
            ))}
          </div>
        )}

        {machineTypes.length > 0 && (
          <div>
            <span className="text-foreground/50">Техника: </span>
            <Link
              href={filterHref({ machineType: undefined })}
              className={!machineType ? "font-semibold underline" : "text-foreground/70"}
            >
              Все
            </Link>
            {machineTypes.map((m) => (
              <span key={m}>
                {" · "}
                <Link
                  href={filterHref({ machineType: m })}
                  className={
                    machineType === m
                      ? "font-semibold underline"
                      : "text-foreground/70"
                  }
                >
                  {m}
                </Link>
              </span>
            ))}
          </div>
        )}

        <div className="ml-auto">
          <span className="text-foreground/50">Сортировка: </span>
          <Link
            href={filterHref({ sort: undefined })}
            className={!sort ? "font-semibold underline" : "text-foreground/70"}
          >
            По умолчанию
          </Link>
          {" · "}
          <Link
            href={filterHref({ sort: "price_asc" })}
            className={
              sort === "price_asc" ? "font-semibold underline" : "text-foreground/70"
            }
          >
            Дешевле
          </Link>
          {" · "}
          <Link
            href={filterHref({ sort: "price_desc" })}
            className={
              sort === "price_desc" ? "font-semibold underline" : "text-foreground/70"
            }
          >
            Дороже
          </Link>
        </div>
      </div>

      {products.length === 0 ? (
        <p className="mt-10 text-foreground/60">
          Нет товаров, подходящих под выбранные фильтры.
        </p>
      ) : (
        <div className="mt-8">
          <ProductGrid products={products} />
        </div>
      )}
    </section>
  );
}
