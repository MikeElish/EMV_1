import { prisma } from "@/lib/prisma";
import { OrdersTable } from "@/components/admin/OrdersTable";

export default async function CrmOrdersPage({
  searchParams,
}: PageProps<"/admin/crm/orders">) {
  const query = await searchParams;
  const orderNumber = typeof query.orderNumber === "string" ? query.orderNumber : undefined;

  const orders = await prisma.order.findMany({
    include: { items: { include: { product: { select: { sku: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="overflow-x-auto">
      <OrdersTable orders={orders} initialOrderNumber={orderNumber} />
    </div>
  );
}
