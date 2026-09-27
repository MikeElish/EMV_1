import { prisma } from "@/lib/prisma";
import { ProductsTable } from "@/components/admin/ProductsTable";

export default async function AdminProductsPage() {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    include: { category: true, pricing: { include: { supplier: { select: { name: true } } } } },
  });

  return <ProductsTable products={products} />;
}
