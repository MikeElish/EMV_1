/** Strips everything but letters/digits so SKUs can be compared regardless of hyphens, spaces, or case. */
export function normalizeArticle(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
