import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatRub } from "@/lib/money";
import { OrderStatusSelect } from "@/components/admin/OrderStatusSelect";

export default async function AdminOrderDetailPage({
  params,
}: PageProps<"/admin/orders/[id]">) {
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!order) notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold">Заказ {order.orderNumber}</h1>

      <div className="mt-6 grid gap-8 sm:grid-cols-2">
        <div>
          <h2 className="text-sm font-medium text-foreground/50">Клиент</h2>
          <p className="mt-1">{order.customerName}</p>
          <p className="text-foreground/70">{order.customerPhone}</p>
          {order.customerEmail && (
            <p className="text-foreground/70">{order.customerEmail}</p>
          )}
          {order.deliveryNote && (
            <p className="mt-2 text-sm text-foreground/60">
              {order.deliveryNote}
            </p>
          )}
        </div>

        <div>
          <h2 className="text-sm font-medium text-foreground/50">Статус</h2>
          <div className="mt-1">
            <OrderStatusSelect orderId={order.id} status={order.status} />
          </div>
          <p className="mt-2 text-sm text-foreground/50">
            Создан: {order.createdAt.toLocaleString("ru-RU")}
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-lg border border-foreground/10 p-4 text-sm">
        {order.items.map((item) => (
          <div key={item.id} className="flex justify-between py-1">
            <span>
              {item.nameSnapshot} × {item.quantity}
            </span>
            <span>{formatRub(item.priceSnapshot * item.quantity)}</span>
          </div>
        ))}
        <div className="mt-2 flex justify-between border-t border-foreground/10 pt-2 font-semibold">
          <span>Итого</span>
          <span>{formatRub(order.totalAmount)}</span>
        </div>
      </div>
    </div>
  );
}
