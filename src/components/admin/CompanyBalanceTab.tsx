"use client";

import { useRouter } from "next/navigation";
import { formatRub } from "@/lib/money";

export type CompanyOrderRow = {
  id: string;
  orderNumber: string;
  createdAt: Date;
  totalAmount: number;
  shippedAt: Date | null;
  paidAmount: number;
  shippedAmount: number;
};

export function CompanyBalanceTab({ orders }: { orders: CompanyOrderRow[] }) {
  const router = useRouter();

  if (orders.length === 0) {
    return <p className="mt-4 text-sm text-foreground/40">Заказов пока нет.</p>;
  }

  return (
    <table className="mt-4 w-full text-sm">
      <thead>
        <tr className="border-b border-foreground/10 text-left text-foreground/50">
          <th className="py-2 pr-4">Дата</th>
          <th className="py-2 pr-4">Номер заказа</th>
          <th className="py-2 pr-4">Сумма</th>
          <th className="py-2 pr-4">Отгружено</th>
          <th className="py-2 pr-4">Оплачено</th>
          <th className="py-2 pr-4">Дата отгрузки</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((order) => (
          <tr key={order.id} className="border-b border-foreground/10">
            <td className="py-2 pr-4">{order.createdAt.toLocaleDateString("ru-RU")}</td>
            <td className="py-2 pr-4">
              <button
                type="button"
                onClick={() =>
                  router.push(`/admin/crm/orders?orderNumber=${encodeURIComponent(order.orderNumber)}`)
                }
                className="font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                {order.orderNumber}
              </button>
            </td>
            <td className="py-2 pr-4">{formatRub(order.totalAmount)}</td>
            <td className="py-2 pr-4">{formatRub(order.shippedAmount)}</td>
            <td className="py-2 pr-4">{formatRub(order.paidAmount)}</td>
            <td className="py-2 pr-4">
              {order.shippedAt ? order.shippedAt.toLocaleDateString("ru-RU") : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
