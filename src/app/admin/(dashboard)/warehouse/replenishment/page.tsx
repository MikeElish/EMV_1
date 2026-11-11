import { prisma } from "@/lib/prisma";
import { getMyAccess, requireSection } from "@/lib/access-server";
import { atLeast } from "@/lib/access";
import { CrmPage } from "@/components/admin/CrmTableFrame";
import { ReplenishmentOrdersTable } from "@/components/admin/ReplenishmentOrdersTable";

export default async function ReplenishmentPage() {
  await requireSection("warehouse.replenishment", "view");
  const me = await getMyAccess();

  const [orders, supplierLines] = await Promise.all([
    prisma.order.findMany({
      where: { buyerCompany: { is: { isOwn: true } } },
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
        items: {
          select: {
            id: true,
            nameSnapshot: true,
            quantity: true,
            priceSnapshot: true,
            status: true,
            product: { select: { sku: true } },
          },
          orderBy: { id: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.supplierOrderLine.findMany({
      where: { forStock: true },
      select: {
        id: true,
        createdAt: true,
        quantity: true,
        price: true,
        quotedPrice: true,
        currency: true,
        status: true,
        product: { select: { name: true, sku: true } },
        supplier: { select: { name: true } },
        purchase: { select: { number: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
  ]);

  return (
    <CrmPage>
      <ReplenishmentOrdersTable orders={orders} supplierLines={supplierLines} canCreate={atLeast(me?.access.warehouse ?? "hide", "edit")} />
    </CrmPage>
  );
}
