import { prisma } from "../src/lib/prisma";
import { syncSelectedOffer } from "../src/lib/supplier-offers";

async function main() {
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      partnerStock: { gt: 0 },
      price: 0,
      offers: {
        some: {
          selected: true,
          noOffer: false,
          price: { gt: 0 },
        },
      },
    },
    select: { id: true, sku: true, name: true },
  });

  console.log(`Products to sync: ${products.length}`);
  let updated = 0;
  let errors = 0;

  for (const product of products) {
    try {
      await syncSelectedOffer(prisma, product.id);
      updated++;
      if (updated % 100 === 0) {
        console.log(`Progress: ${updated}/${products.length}`);
      }
    } catch (error) {
      errors++;
      console.error(`Failed to sync ${product.sku} (${product.id}):`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`Done. Updated: ${updated}, errors: ${errors}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
