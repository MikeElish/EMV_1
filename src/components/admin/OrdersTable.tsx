"use client";

import { useMemo, useState } from "react";
import { formatRub } from "@/lib/money";
import { ORDER_STATUS_LABELS } from "@/lib/validators/orders";
import { OrderStatusSelect } from "@/components/admin/OrderStatusSelect";
import { PaidToggle } from "@/components/admin/PaidToggle";
import { DeliveryDateInput } from "@/components/admin/DeliveryDateInput";
import { OrderFilesMenu } from "@/components/admin/OrderFilesMenu";
import { TableSearchInput } from "@/components/admin/TableSearchInput";
import type { Order, OrderItem, OrderStatus } from "@prisma/client";

type Row = {
  order: Order;
  item: OrderItem & { product: { sku: string } | null };
};

export function OrdersTable({
  orders,
}: {
  orders: (Order & { items: (OrderItem & { product: { sku: string } | null })[] })[];
}) {
  const [search, setSearch] = useState("");

  const rows: Row[] = useMemo(
    () => orders.flatMap((order) => order.items.map((item) => ({ order, item }))),
    [orders]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter(({ order, item }) =>
      [
        order.orderNumber,
        item.nameSnapshot,
        item.product?.sku,
        ORDER_STATUS_LABELS[order.status as OrderStatus],
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [rows, search]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Заказы</h1>
        <TableSearchInput value={search} onChange={setSearch} placeholder="Поиск по заказам..." />
      </div>

      {orders.length === 0 ? (
        <p className="mt-4 text-sm text-foreground/40">Заказов пока нет.</p>
      ) : filtered.length === 0 ? (
        <p className="mt-4 text-sm text-foreground/40">Ничего не найдено.</p>
      ) : (
        <table className="mt-4 w-full text-sm">
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
              <th className="py-2 pr-4">Файлы</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(({ order, item }) => (
              <tr key={item.id} className="border-b border-foreground/10">
                <td className="py-2 pr-4 font-medium">{order.orderNumber}</td>
                <td className="py-2 pr-4">{item.nameSnapshot}</td>
                <td className="py-2 pr-4">{item.product?.sku ?? "—"}</td>
                <td className="py-2 pr-4">{item.quantity}</td>
                <td className="py-2 pr-4">{formatRub(item.priceSnapshot)}</td>
                <td className="py-2 pr-4">{formatRub(order.totalAmount)}</td>
                <td className="py-2 pr-4">
                  <OrderStatusSelect orderId={order.id} status={order.status as OrderStatus} />
                </td>
                <td className="py-2 pr-4">
                  <DeliveryDateInput orderId={order.id} deliveryDate={order.deliveryDate} />
                </td>
                <td className="py-2 pr-4">
                  <PaidToggle orderId={order.id} paid={order.paid} />
                </td>
                <td className="py-2 pr-4">
                  <OrderFilesMenu orderId={order.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
