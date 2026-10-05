"use client";

import { createContext, useContext } from "react";
import type { Product } from "@prisma/client";
import { formatRub } from "@/lib/money";
import type { ShopOffer } from "@/lib/shop-offer";
import { RowOrderButton } from "@/components/shop/RowOrderButton";

// Products with several supplier offers (Проценка): the shop shows «от …»
// and lets the customer pick one. Only site prices, quality and delivery
// time reach the browser -- never the supplier or the purchase price.

export type { ShopOffer };

const OffersContext = createContext<Record<string, ShopOffer[]>>({});

export function ShopOffersProvider({
  offers,
  children,
}: {
  offers: Record<string, ShopOffer[]>;
  children: React.ReactNode;
}) {
  return <OffersContext.Provider value={offers}>{children}</OffersContext.Provider>;
}

/** The product's offers when it has more than one, else null. */
export function useProductOffers(productId: string): ShopOffer[] | null {
  const offers = useContext(OffersContext)[productId];
  return offers && offers.length > 1 ? offers : null;
}

export const offerDays = (o: ShopOffer) => (o.deliveryDays === null ? "—" : `${o.deliveryDays} дн.`);
export const offerLabel = (o: ShopOffer) => [o.quality, o.deliveryDays !== null ? `${o.deliveryDays} дн.` : null].filter(Boolean).join(", ");

/** «от 1 200 ₽» for a product with several offers, its own price otherwise. */
export function OfferPrice({ product }: { product: Product }) {
  const offers = useProductOffers(product.id);
  if (!offers) return <>{formatRub(product.price)}</>;
  return (
    <>
      <span className="font-normal text-foreground/60">от </span>
      {formatRub(Math.min(product.price, ...offers.map((o) => o.price)))}
    </>
  );
}

/** The list that drops down under a product: Качество, Цена, Срок поставки, Заказать. */
export function OffersDropdown({ product, offers }: { product: Product; offers: ShopOffer[] }) {
  return (
    <div className="border-b border-foreground/10 bg-foreground/[0.03] px-3 py-2" role="region" aria-label="Предложения">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-foreground/50">
            <th className="pb-1 pr-3 font-normal">Качество</th>
            <th className="pb-1 pr-3 text-right font-normal">Цена</th>
            <th className="pb-1 pr-3 font-normal">Срок поставки</th>
            <th className="pb-1" />
          </tr>
        </thead>
        <tbody>
          {offers.map((o) => (
            <tr key={o.id} className="border-t border-foreground/10">
              <td className="py-1.5 pr-3">{o.quality ?? "—"}</td>
              <td className="whitespace-nowrap py-1.5 pr-3 text-right font-medium">{formatRub(o.price)}</td>
              <td className="whitespace-nowrap py-1.5 pr-3">{offerDays(o)}</td>
              <td className="py-1.5 text-right">
                <div className="flex justify-end">
                  <RowOrderButton product={product} offer={o} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Product card / quick view: all offers under the price, each with «Заказать». */
export function ProductOffersBlock({ product }: { product: Product }) {
  const offers = useProductOffers(product.id);
  if (!offers) return null;
  return (
    <div className="mt-5 overflow-hidden rounded-lg border border-foreground/10">
      <p className="px-3 pt-2 text-sm font-medium">Предложения</p>
      <OffersDropdown product={product} offers={offers} />
    </div>
  );
}
