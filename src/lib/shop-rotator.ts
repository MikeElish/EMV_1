import type { Product } from "@prisma/client";
import type { RotatorDirection } from "@/components/shop/NewArrivalsRotator";

/** The sections of the rotator under the shop homepage and the cart. */
export function rotatorDirections(products: Product[]): RotatorDirection[] {
  const inStockPool = products.filter((p) => p.stock > 0);
  const readyToOfferPool = products.filter((p) => p.stock <= 0);
  // The latest upload that brought goods on hand -- one product added by hand
  // (and not in stock) mustn't empty the section.
  const lastUploadAt = inStockPool.reduce<Date | null>(
    (max, p) => (!max || p.newArrivalAt > max ? p.newArrivalAt : max),
    null
  );
  const newArrivalsPool = lastUploadAt
    ? inStockPool.filter((p) => p.newArrivalAt.getTime() === lastUploadAt.getTime())
    : [];

  return [
    { key: "inStock", label: "В наличии", items: inStockPool },
    { key: "readyToOffer", label: "Готовы предложить", items: readyToOfferPool },
    { key: "newArrivals", label: "Новое поступление", items: newArrivalsPool },
  ];
}
