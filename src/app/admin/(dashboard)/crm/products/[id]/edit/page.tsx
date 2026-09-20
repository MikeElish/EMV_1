import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateProduct } from "@/actions/admin/products";
import { ProductForm } from "@/components/admin/ProductForm";

type Attributes = { machineType?: string; compatibleWith?: string[] } | null;

export default async function EditProductPage({
  params,
}: PageProps<"/admin/crm/products/[id]/edit">) {
  const { id } = await params;
  const [product, categories] = await Promise.all([
    prisma.product.findUnique({ where: { id } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!product) notFound();

  const attributes = product.attributes as Attributes;

  return (
    <div>
      <h1 className="text-2xl font-bold">Изменить товар</h1>
      <ProductForm
        categories={categories}
        initial={{
          sku: product.sku,
          name: product.name,
          slug: product.slug,
          description: product.description ?? undefined,
          priceRub: (product.price / 100).toString(),
          stock: product.stock,
          categoryId: product.categoryId,
          brand: product.brand ?? undefined,
          machineType: attributes?.machineType,
          compatibleWithText: attributes?.compatibleWith?.join(", "),
          images: product.images,
          isActive: product.isActive,
        }}
        onSubmit={(input) => updateProduct(id, input)}
      />
    </div>
  );
}
