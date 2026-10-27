"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { formatShopPrice } from "@/lib/money";

// The shop pages are cached with the shop prices. A signed-in client whose
// company has its own «Тип цен» gets its prices from /shop/my-prices: every
// price on screen asks for its product, the asks are batched into one request.

type Prices = Record<string, { price: number; offers: Record<string, number> }>;
type Ctx = { prices: Prices; want: (productIds: string[]) => void };

const CustomerPricesContext = createContext<Ctx>({ prices: {}, want: () => {} });

const BATCH = 200;

export function CustomerPricesProvider({ children }: { children: ReactNode }) {
  const [prices, setPrices] = useState<Prices>({});
  const status = useRef<"unknown" | "on" | "off">("unknown");
  const asked = useRef(new Set<string>());
  const pending = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    timer.current = null;
    const ids = [...pending.current];
    pending.current.clear();
    for (let i = 0; i < ids.length || (i === 0 && status.current === "unknown"); i += BATCH) {
      const chunk = ids.slice(i, i + BATCH);
      try {
        const res = await fetch(`/shop/my-prices?ids=${encodeURIComponent(chunk.join(","))}`, { cache: "no-store" });
        const json = (await res.json()) as { active: boolean; prices?: Prices };
        if (!json.active) {
          status.current = "off";
          return;
        }
        status.current = "on";
        if (json.prices) setPrices((prev) => ({ ...prev, ...json.prices }));
      } catch {
        // Network trouble: the shop prices stay; checkout prices on the server anyway.
        chunk.forEach((id) => asked.current.delete(id));
      }
    }
  }, []);

  const want = useCallback(
    (productIds: string[]) => {
      if (status.current === "off") return;
      for (const id of productIds) {
        if (asked.current.has(id)) continue;
        asked.current.add(id);
        pending.current.add(id);
      }
      if (pending.current.size && !timer.current) timer.current = setTimeout(flush, 30);
    },
    [flush]
  );

  // One probe on load: guests and Опт clients stop here.
  useEffect(() => {
    if (status.current === "unknown" && !timer.current) timer.current = setTimeout(flush, 0);
  }, [flush]);

  const value = useMemo(() => ({ prices, want }), [prices, want]);
  return <CustomerPricesContext.Provider value={value}>{children}</CustomerPricesContext.Provider>;
}

/** The product's price for the signed-in client, or `shopPrice` while unknown / for everyone else. */
export function useCustomerPrice(productId: string, shopPrice: number): number {
  const { prices, want } = useContext(CustomerPricesContext);
  useEffect(() => want([productId]), [productId, want]);
  return prices[productId]?.price ?? shopPrice;
}

/** Same for one supplier offer of the product. */
export function useCustomerOfferPrice(productId: string, offerId: string, shopPrice: number): number {
  const { prices, want } = useContext(CustomerPricesContext);
  useEffect(() => want([productId]), [productId, want]);
  return prices[productId]?.offers[offerId] ?? shopPrice;
}

/** The product's entry (own price and offer prices) for the signed-in client, if it has its own prices. */
export function useCustomerEntry(productId: string) {
  const { prices, want } = useContext(CustomerPricesContext);
  useEffect(() => want([productId]), [productId, want]);
  return prices[productId];
}

/** «12 345 ₽» / «По запросу» with the client's own price. */
export function CustomerPriceText({ productId, price }: { productId: string; price: number }) {
  return <>{formatShopPrice(useCustomerPrice(productId, price))}</>;
}

/** For lists (the cart): ask for all at once, read with `priceOf`. */
export function useCustomerPriceList(productIds: string[]) {
  const { prices, want } = useContext(CustomerPricesContext);
  const key = productIds.join(",");
  useEffect(() => want(key ? key.split(",") : []), [key, want]);
  return useCallback(
    (productId: string, offerId: string | undefined, shopPrice: number) =>
      (offerId ? prices[productId]?.offers[offerId] : prices[productId]?.price) ?? shopPrice,
    [prices]
  );
}
