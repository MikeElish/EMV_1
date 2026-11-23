import { prisma } from "../src/lib/prisma";

async function main() {
  // Products with partner stock, no price and no supplier offers.
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      partnerStock: { gt: 0 },
      price: 0,
      offers: { none: {} },
    },
    select: { id: true, sku: true, name: true },
  });

  console.log(`Products to mark as noOffer: ${products.length}`);

  for (const product of products) {
    await prisma.$transaction([
      prisma.product.update({
        where: { id: product.id },
        data: { noOffer: true },
      }),
      prisma.productPricing.upsert({
        where: { productId: product.id },
        create: {
          productId: product.id,
          purchasePrice: 0,
          retailPrice: 0,
          dealerPrice: 0,
          tenderPrice: 0,
          supplierId: null,
        },
        update: {
          purchasePrice: 0,
          retailPrice: 0,
          dealerPrice: 0,
          tenderPrice: 0,
          supplierId: null,
        },
      }),
    ]);
  }

  // Remove phantom own-stock product.
  const phantom = await prisma.product.updateMany({
    where: { sku: "P166173", stock: { gt: 0 } },
    data: { stock: 0 },
  });
  console.log(`Phantom own-stock cleared: ${phantom.count}`);

  console.log("Done");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
