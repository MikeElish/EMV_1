import { customerPrices, sessionPriceTier } from "@/lib/customer-pricing";

const MAX_IDS = 300;

/**
 * The signed-in client's own prices (its company's «Тип цен») for the
 * products on screen. The shop pages are cached with the shop prices; the
 * browser swaps these in. `{ active: false }` for everyone else.
 */
export async function GET(request: Request) {
  const tier = await sessionPriceTier();
  if (!tier) return Response.json({ active: false }, { headers: { "Cache-Control": "no-store" } });
  const ids = (new URL(request.url).searchParams.get("ids") ?? "").split(",").filter(Boolean).slice(0, MAX_IDS);
  const prices = ids.length ? await customerPrices(ids, tier) : {};
  return Response.json({ active: true, prices }, { headers: { "Cache-Control": "no-store, private" } });
}
