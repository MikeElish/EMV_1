import type { Product } from "@prisma/client";
import { normalizeArticle } from "@/lib/search-normalize";

export type BulkSearchRow = {
  brand: string;
  sku: string;
  quantity: number;
};

export type MatchedBulkSearchRow = BulkSearchRow & {
  product: Product | null;
};

export function matchRows(rows: BulkSearchRow[], products: Product[]): MatchedBulkSearchRow[] {
  const byArticle = new Map<string, Product[]>();
  for (const product of products) {
    const key = normalizeArticle(product.sku);
    const group = byArticle.get(key);
    if (group) group.push(product);
    else byArticle.set(key, [product]);
  }

  return rows.map((row) => {
    const candidates = byArticle.get(normalizeArticle(row.sku)) ?? [];
    let product: Product | null = null;
    if (candidates.length === 1) {
      product = candidates[0];
    } else if (candidates.length > 1) {
      const brandMatch = candidates.find(
        (p) => (p.brand ?? "").trim().toLowerCase() === row.brand.trim().toLowerCase()
      );
      product = brandMatch ?? candidates[0];
    }
    return { ...row, product };
  });
}
