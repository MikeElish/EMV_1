import { prisma } from "@/lib/prisma";
import { getMyAccess } from "@/lib/access-server";
import { CrmPage } from "@/components/admin/CrmTableFrame";
import { OrdersTable } from "@/components/admin/OrdersTable";

export default async function CrmOrdersPage({
  searchParams,
}: PageProps<"/admin/crm/orders">) {
  const query = await searchParams;
  const orderNumber = typeof query.orderNumber === "string" ? query.orderNumber : undefined;

  const orders = await prisma.order.findMany({
    include: {
      items: {
        include: { product: { select: { sku: true, stock: true } } },
        orderBy: { id: "asc" },
      },
      extraCosts: {
        select: { id: true, number: true, date: true, amount: true, service: { select: { name: true } } },
        orderBy: { date: "asc" },
      },
      user: {
        select: {
          lastName: true,
          firstName: true,
          patronymic: true,
          login: true,
          company: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const me = await getMyAccess();

  return (
    <CrmPage>
      <OrdersTable orders={orders} initialOrderNumber={orderNumber} canDelete={me?.role === "OWNER"} />
    </CrmPage>
  );
}
