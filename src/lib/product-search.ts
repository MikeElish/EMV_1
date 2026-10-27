import type { Prisma } from "@prisma/client";

/**
 * «209-943-7560» → «2099437560»: articles are stored without the dashes, dots
 * and slashes customers type (and catalogs print). Null when there's nothing
 * to strip or the word isn't an article.
 */
function bareArticle(word: string): string | null {
  const bare = word.replace(/[-.\/_\\]/g, "");
  return bare !== word && /\d/.test(bare) && bare.length >= 4 ? bare : null;
}

/**
 * Shop search: every word of the query must be found in the name, article or
 * brand — «фильтр hyundai» finds HYUNDAI filters, in any word order. An
 * article typed with separators also matches the article without them.
 */
export function productSearchWhere(q: string): Prisma.ProductWhereInput {
  const words = q.trim().split(/\s+/).filter(Boolean).slice(0, 6);
  return {
    isActive: true,
    category: { isActive: true },
    AND: words.map((word) => {
      const bare = bareArticle(word);
      return {
        OR: [
          { name: { contains: word, mode: "insensitive" } },
          { sku: { contains: word, mode: "insensitive" } },
          { brand: { contains: word, mode: "insensitive" } },
          ...(bare ? [{ sku: { contains: bare, mode: "insensitive" as const } }] : []),
        ],
      };
    }),
  };
}
