import { prisma } from "@/lib/prisma";
import { ProductsTable } from "@/components/admin/ProductsTable";
import { CrmPage } from "@/components/admin/CrmTableFrame";
import { RESERVE_STATUSES } from "@/lib/validators/orders";

export default async function AdminProductsPage() {
  const [products, reserved] = await Promise.all([
    prisma.product.findMany({
      orderBy: { createdAt: "desc" },
      include: { category: true, pricing: { include: { supplier: { select: { name: true } } } } },
    }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: { status: { in: RESERVE_STATUSES } },
      _sum: { quantity: true },
    }),
  ]);

  // Incoming (supplier orders) arrives with "Заказ поставщику"; zero until then.
  const reserve = Object.fromEntries(reserved.map((r) => [r.productId, r._sum.quantity ?? 0]));

  return (
    <CrmPage>
      <ProductsTable products={products} reserve={reserve} />
    </CrmPage>
  );
}
