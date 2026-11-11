import { prisma } from "@/lib/prisma";
import { createProduct } from "@/actions/admin/products";
import { NewProductForm } from "@/components/admin/NewProductForm";
import { getMarkups, getSuppliers } from "@/lib/price-settings";

export default async function NewProductPage() {
  const [categories, suppliers, markups] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    getSuppliers(),
    getMarkups(),
  ]);

  return <NewProductForm categories={categories} suppliers={suppliers} markups={markups} onSubmit={createProduct} />;
}
