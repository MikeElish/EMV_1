import { formatRub } from "@/lib/money";
import { ORDER_STATUS_LABELS } from "@/lib/validators/orders";
import { OrderActionMenu, type LatestDocs } from "@/components/shop/OrderActionMenu";
import type { Order, OrderItem, OrderStatus } from "@prisma/client";

type OrderWithExtras = Order & {
  items: (OrderItem & { product: { sku: string } | null })[];
  latestDocs: LatestDocs;
};

export function CustomerOrdersTable({ orders }: { orders: OrderWithExtras[] }) {
  if (orders.length === 0) {
    return <p className="text-sm text-foreground/40">У вас пока нет заказов.</p>;
  }

  const rows = orders.flatMap((order) =>
    order.items.map((item) => ({ order, item }))
  );

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-foreground/10 text-left text-foreground/50">
          <th className="py-2 pr-4">Номер заказа</th>
          <th className="py-2 pr-4">Наименование товара</th>
          <th className="py-2 pr-4">Артикул</th>
          <th className="py-2 pr-4">Количество</th>
          <th className="py-2 pr-4">Цена</th>
          <th className="py-2 pr-4">Всего</th>
          <th className="py-2 pr-4">Статус</th>
          <th className="py-2 pr-4">Дата поставки</th>
          <th className="py-2 pr-4">Оплата</th>
          <th className="py-2 pr-4">Действие</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ order, item }) => (
          <tr key={item.id} className="border-b border-foreground/10">
            <td className="py-2 pr-4 font-medium">{order.orderNumber}</td>
            <td className="py-2 pr-4">{item.nameSnapshot}</td>
            <td className="py-2 pr-4">{item.product?.sku ?? "—"}</td>
            <td className="py-2 pr-4">{item.quantity}</td>
            <td className="py-2 pr-4">{formatRub(item.priceSnapshot)}</td>
            <td className="py-2 pr-4">{formatRub(order.totalAmount)}</td>
            <td className="py-2 pr-4">{ORDER_STATUS_LABELS[order.status as OrderStatus]}</td>
            <td className="py-2 pr-4">
              {order.deliveryDate
                ? new Date(order.deliveryDate).toLocaleDateString("ru-RU")
                : "—"}
            </td>
            <td className="py-2 pr-4">{order.paid ? "Оплачено" : "Не оплачено"}</td>
            <td className="py-2 pr-4">
              <OrderActionMenu orderId={order.id} latestDocs={order.latestDocs} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
