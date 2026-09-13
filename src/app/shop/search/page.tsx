import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { ProductGrid } from "@/components/shop/ProductGrid";
import { logProductSearches } from "@/actions/shop/search-log";

export default async function SearchPage({
  searchParams,
}: PageProps<"/shop/search">) {
  const query = await searchParams;
  const q = typeof query.q === "string" ? query.q.trim() : "";

  const products = q
    ? await prisma.product.findMany({
        where: {
          isActive: true,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { sku: { contains: q, mode: "insensitive" } },
            { brand: { contains: q, mode: "insensitive" } },
          ],
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  // A free-text query with no matches has no structured brand/sku pair to
  // attribute a "not found" search to, so only successful matches are logged.
  if (products.length > 0) {
    after(() =>
      logProductSearches(
        products.map((p) => ({
          productId: p.id,
          brand: p.brand ?? "—",
          sku: p.sku,
          name: p.name,
          inSystem: true,
        }))
      )
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="text-2xl font-bold">
        {q ? `Результаты по запросу «${q}»` : "Введите запрос для поиска"}
      </h1>

      {q && products.length === 0 && (
        <p className="mt-6 text-foreground/60">Ничего не найдено.</p>
      )}

      {products.length > 0 && (
        <div className="mt-8">
          <ProductGrid products={products} />
        </div>
      )}
    </section>
  );
}
