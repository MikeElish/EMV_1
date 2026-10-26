import type { Prisma } from "@prisma/client";

/**
 * Shop search: every word of the query must be found in the name, article or
 * brand — «фильтр hyundai» finds HYUNDAI filters, in any word order.
 */
export function productSearchWhere(q: string): Prisma.ProductWhereInput {
  const words = q.trim().split(/\s+/).filter(Boolean).slice(0, 6);
  return {
    isActive: true,
    category: { isActive: true },
    AND: words.map((word) => ({
      OR: [
        { name: { contains: word, mode: "insensitive" } },
        { sku: { contains: word, mode: "insensitive" } },
        { brand: { contains: word, mode: "insensitive" } },
      ],
    })),
  };
}
