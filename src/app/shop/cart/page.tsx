import { prisma } from "@/lib/prisma";
import { CartPageClient } from "@/components/shop/CartPageClient";
import { ShopOffersProvider } from "@/components/shop/ShopOffers";
import { getShopOffers } from "@/lib/supplier-offers";
import { rotatorDirections } from "@/lib/shop-rotator";

export default async function CartPage() {
  // Same sections as the shop homepage's rotator, shown here too so the cart
  // isn't a dead end while the customer decides.
  const allActiveProducts = await prisma.product.findMany({
    where: { isActive: true },
  });
  const offers = await getShopOffers(allActiveProducts.map((p) => p.id));

  return (
    <ShopOffersProvider offers={offers}>
      <CartPageClient directions={rotatorDirections(allActiveProducts)} />
    </ShopOffersProvider>
  );
}
