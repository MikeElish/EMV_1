import { prisma } from "@/lib/prisma";
import { OrdersTable } from "@/components/admin/OrdersTable";

export default async function CrmOrdersPage() {
  const orders = await prisma.order.findMany({
    include: { items: { include: { product: { select: { sku: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="overflow-x-auto">
      <OrdersTable orders={orders} />
    </div>
  );
}
