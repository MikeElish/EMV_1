import { prisma } from "@/lib/prisma";
import { OrdersTable } from "@/components/admin/OrdersTable";

export default async function CrmOrdersPage() {
  const orders = await prisma.order.findMany({
    include: { items: { include: { product: { select: { sku: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-lg font-semibold">Заказы</h1>
      <div className="mt-4 overflow-x-auto">
        <OrdersTable orders={orders} />
      </div>
    </div>
  );
}
