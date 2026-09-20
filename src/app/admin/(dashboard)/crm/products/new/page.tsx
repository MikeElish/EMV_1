import { prisma } from "@/lib/prisma";
import { createProduct } from "@/actions/admin/products";
import { ProductForm } from "@/components/admin/ProductForm";

export default async function NewProductPage() {
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <h1 className="text-2xl font-bold">Новый товар</h1>
      <ProductForm categories={categories} onSubmit={createProduct} />
    </div>
  );
}
