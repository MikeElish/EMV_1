import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatRub } from "@/lib/money";

const STATUS_LABEL: Record<string, string> = {
  NEW: "Новый",
  PAID: "Оплачен",
  PROCESSING: "В обработке",
  SHIPPED: "Отправлен",
  DONE: "Выполнен",
  CANCELLED: "Отменён",
};

export default async function AdminOrdersPage() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">Заказы</h1>

      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b border-foreground/10 text-left text-foreground/50">
            <th className="py-2">Номер</th>
            <th className="py-2">Клиент</th>
            <th className="py-2">Сумма</th>
            <th className="py-2">Статус</th>
            <th className="py-2">Дата</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-b border-foreground/10">
              <td className="py-2">
                <Link
                  href={`/admin/orders/${order.id}`}
                  className="font-medium hover:underline"
                >
                  {order.orderNumber}
                </Link>
              </td>
              <td className="py-2">
                <div>{order.customerName}</div>
                <div className="text-xs text-foreground/40">
                  {order.customerPhone}
                </div>
              </td>
              <td className="py-2">{formatRub(order.totalAmount)}</td>
              <td className="py-2">{STATUS_LABEL[order.status] ?? order.status}</td>
              <td className="py-2 text-foreground/50">
                {order.createdAt.toLocaleDateString("ru-RU")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
