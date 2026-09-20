import { BRANDS } from "@/content/brands";

const BRAND_BY_LOWER = new Map(BRANDS.map((brand) => [brand.toLowerCase(), brand]));

/** Case-insensitively maps a typed brand to its canonical (as-listed) casing; unlisted brands pass through trimmed. */
export function normalizeBrand(raw: string): string {
  const trimmed = raw.trim();
  return BRAND_BY_LOWER.get(trimmed.toLowerCase()) ?? trimmed;
}

/** Case-insensitively looks up a brand in the canonical list; null if it isn't one of the known brands. */
export function findCanonicalBrand(raw: string): string | null {
  return BRAND_BY_LOWER.get(raw.trim().toLowerCase()) ?? null;
}
