import { prisma } from "@/lib/prisma";
import { getMyAccess, requireSection } from "@/lib/access-server";
import { atLeast } from "@/lib/access";
import { CrmPage } from "@/components/admin/CrmTableFrame";
import { ReplenishmentOrdersTable } from "@/components/admin/ReplenishmentOrdersTable";

export default async function ReplenishmentPage() {
  await requireSection("warehouse", "view");
  const me = await getMyAccess();

  const orders = await prisma.order.findMany({
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
  });

  return (
    <CrmPage>
      <ReplenishmentOrdersTable orders={orders} canCreate={atLeast(me?.access.warehouse ?? "hide", "edit")} />
    </CrmPage>
  );
}
