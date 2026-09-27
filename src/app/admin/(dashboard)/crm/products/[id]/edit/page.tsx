import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateProduct } from "@/actions/admin/products";
import { ProductForm } from "@/components/admin/ProductForm";
import { getMarkups, getSuppliers } from "@/lib/price-settings";

type Attributes = { machineType?: string; compatibleWith?: string[] } | null;

export default async function EditProductPage({
  params,
}: PageProps<"/admin/crm/products/[id]/edit">) {
  const { id } = await params;
  const [product, categories, suppliers, markups] = await Promise.all([
    prisma.product.findUnique({ where: { id }, include: { pricing: true } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    getSuppliers(),
    getMarkups(),
  ]);

  if (!product) notFound();

  const attributes = product.attributes as Attributes;

  return (
    <div>
      <h1 className="text-2xl font-bold">Изменить товар</h1>
      <ProductForm
        categories={categories}
        suppliers={suppliers}
        markups={markups}
        initial={{
          sku: product.sku,
          name: product.name,
          description: product.description ?? undefined,
          stock: product.stock,
          categoryId: product.categoryId,
          brand: product.brand ?? undefined,
          machineType: attributes?.machineType,
          compatibleWithText: attributes?.compatibleWith?.join(", "),
          images: product.images,
          isActive: product.isActive,
        }}
        initialPricing={
          product.pricing ? {
            supplierId: product.pricing.supplierId,
            purchase: product.pricing.purchasePrice,
            retail: product.pricing.retailPrice,
            wholesale: product.price,
            dealer: product.pricing.dealerPrice,
          } : undefined
        }
        onSubmit={updateProduct.bind(null, id)}
      />
    </div>
  );
}
