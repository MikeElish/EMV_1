import { prisma } from "@/lib/prisma";
import { productSearchWhere } from "@/lib/product-search";
import { customerPrices, sessionPriceTier } from "@/lib/customer-pricing";

export type SearchSuggestion = {
  slug: string;
  name: string;
  sku: string;
  brand: string | null;
  price: number; // kopecks
  inStock: boolean;
  image: string | null;
};

const LIMIT = 8;

/** Matches under the search bar, as the customer types. */
export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  if (!q) return Response.json({ items: [], total: 0 });

  const where = productSearchWhere(q);
  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      // In stock first, then by name.
      orderBy: [{ stock: "desc" }, { name: "asc" }],
      take: LIMIT,
      select: { id: true, slug: true, name: true, sku: true, brand: true, price: true, stock: true, images: true },
    }),
    prisma.product.count({ where }),
  ]);
  // A signed-in client with its own «Тип цен» sees its prices here too.
  const tier = await sessionPriceTier();
  const own = tier ? await customerPrices(rows.map((p) => p.id), tier) : {};

  const items: SearchSuggestion[] = rows.map((p) => ({
    slug: p.slug,
    name: p.name,
    sku: p.sku,
    brand: p.brand,
    price: own[p.id]?.price ?? p.price,
    inStock: p.stock > 0,
    image: p.images[0] ?? null,
  }));
  return Response.json({ items, total }, { headers: { "Cache-Control": "no-store" } });
}
