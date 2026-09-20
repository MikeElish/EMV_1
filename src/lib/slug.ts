export function slugifySku(sku: string): string {
  return sku
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * The product URL slug is generated, never typed by hand: "brand_sku",
 * each half cleaned the same way as slugifySku. Falls back to just the SKU
 * when there's no brand -- still unique, since sku is a unique column.
 */
export function buildProductSlug(brand: string | null | undefined, sku: string): string {
  const skuPart = slugifySku(sku);
  const brandPart = brand ? slugifySku(brand) : "";
  return brandPart ? `${brandPart}_${skuPart}` : skuPart;
}
