import { prisma } from "@/lib/prisma";
import { CartPageClient } from "@/components/shop/CartPageClient";
import type { RotatorDirection } from "@/components/shop/NewArrivalsRotator";

export default async function CartPage() {
  // Same pools/labels as the shop homepage's "Готовы предложить" rotator,
  // shown here too so the cart isn't a dead end while the customer decides.
  const allActiveProducts = await prisma.product.findMany({
    where: { isActive: true },
  });

  const inStockPool = allActiveProducts.filter((p) => p.stock > 0);
  const readyToOfferPool = allActiveProducts.filter((p) => p.stock <= 0);
  const lastUploadAt = allActiveProducts.reduce<Date | null>(
    (max, p) => (!max || p.newArrivalAt > max ? p.newArrivalAt : max),
    null
  );
  const newArrivalsPool = lastUploadAt
    ? inStockPool.filter((p) => p.newArrivalAt.getTime() === lastUploadAt.getTime())
    : [];

  const directions: RotatorDirection[] = [
    { key: "inStock", label: "В наличии", items: inStockPool },
    { key: "readyToOffer", label: "Готовы предложить", items: readyToOfferPool },
    { key: "newArrivals", label: "Новое поступление", items: newArrivalsPool },
  ];

  return <CartPageClient directions={directions} />;
}
