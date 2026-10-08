/** Only the customer's own orders page may be the target of ?next= on /crm. */
export function customerNextPath(value: unknown): string | undefined {
  return typeof value === "string" && /^\/shop\/orders(\?|$)/.test(value) ? value : undefined;
}
