import { prisma } from "../src/lib/prisma";

async function main() {
  const product = await prisma.product.findUnique({
    where: { sku: "SERVICE-DELIVERY-SMALL" },
    select: { id: true, name: true },
  });
  if (!product) {
    console.log("Product SERVICE-DELIVERY-SMALL not found");
    return;
  }

  const orderItemsCount = await prisma.orderItem.count({ where: { productId: product.id } });
  if (orderItemsCount > 0) {
    console.log(`Product has ${orderItemsCount} order items; not deleting`);
    return;
  }

  await prisma.productPricing.deleteMany({ where: { productId: product.id } });
  await prisma.product.delete({ where: { id: product.id } });
  console.log(`Deleted product ${product.name} (${product.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
