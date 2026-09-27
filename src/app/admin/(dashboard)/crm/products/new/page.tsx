import { prisma } from "@/lib/prisma";
import { createProduct } from "@/actions/admin/products";
import { ProductForm } from "@/components/admin/ProductForm";
import { getMarkups, getSuppliers } from "@/lib/price-settings";

export default async function NewProductPage() {
  const [categories, suppliers, markups] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    getSuppliers(),
    getMarkups(),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Новый товар</h1>
      <ProductForm categories={categories} suppliers={suppliers} markups={markups} onSubmit={createProduct} />
    </div>
  );
}
