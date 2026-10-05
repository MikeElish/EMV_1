import { prisma } from "@/lib/prisma";
import { getSuppliers } from "@/lib/price-settings";
import { CrmPage } from "@/components/admin/CrmTableFrame";
import { PriceCheckBoard } from "@/components/admin/PriceCheckBoard";

// Проценка: nomenclature on the left, the chosen article's supplier offers on
// the right.
export default async function CrmPriceCheckPage({ searchParams }: PageProps<"/admin/crm/price-check">) {
  const { product } = await searchParams;
  const [products, updated, checking, suppliers] = await Promise.all([
    prisma.product.findMany({
      select: { id: true, brand: true, name: true, sku: true, category: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.supplierOffer.groupBy({ by: ["productId"], _max: { priceUpdatedAt: true } }),
    prisma.orderItem.groupBy({ by: ["productId"], where: { status: "CHECKING" }, _count: true }),
    getSuppliers(),
  ]);
  const updatedOf = new Map(updated.map((u) => [u.productId, u._max.priceUpdatedAt]));
  const checkingOf = new Map(checking.map((c) => [c.productId, c._count]));

  return (
    <CrmPage>
      <PriceCheckBoard
        products={products.map((p) => ({
          id: p.id,
          brand: p.brand,
          name: p.name,
          sku: p.sku,
          category: p.category.name,
          updatedAt: updatedOf.get(p.id) ?? null,
          checking: checkingOf.get(p.id) ?? 0,
        }))}
        suppliers={suppliers}
        initialProductId={typeof product === "string" ? product : undefined}
      />
    </CrmPage>
  );
}
