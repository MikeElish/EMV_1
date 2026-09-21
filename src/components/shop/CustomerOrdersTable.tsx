"use client";

import { useMemo, useState } from "react";
import { formatRub } from "@/lib/money";
import { ORDER_STATUS_LABELS } from "@/lib/validators/orders";
import { getPaymentDisplayStatus } from "@/lib/validators/payment-status";
import { OrderActionMenu, type LatestDocs } from "@/components/shop/OrderActionMenu";
import { OrderStatusBadge } from "@/components/shop/OrderStatusBadge";
import { PaymentStatusBadge } from "@/components/shop/PaymentStatusBadge";
import { SuggestField } from "@/components/SuggestField";
import type { Order, OrderItem, OrderStatus } from "@prisma/client";

function paymentStatusText(order: Pick<Order, "paid" | "plannedPaymentDate">): string {
  const status = getPaymentDisplayStatus(order);
  if (status.kind === "paid") return "Оплачено";
  if (status.kind === "unpaid") return "Не оплачено";
  return `План оплаты ${status.date.toLocaleDateString("ru-RU")}`;
}

type OrderWithExtras = Order & {
  items: (OrderItem & { product: { sku: string } | null })[];
  latestDocs: LatestDocs;
};

type Row = {
  order: OrderWithExtras;
  item: OrderItem & { product: { sku: string } | null };
};

const COLUMNS: {
  key: string;
  label: string;
  accessor: (row: Row) => string;
}[] = [
  { key: "orderNumber", label: "Номер заказа", accessor: (r) => r.order.orderNumber },
  { key: "name", label: "Наименование товара", accessor: (r) => r.item.nameSnapshot },
  { key: "sku", label: "Артикул", accessor: (r) => r.item.product?.sku ?? "—" },
  { key: "quantity", label: "Количество", accessor: (r) => String(r.item.quantity) },
  { key: "price", label: "Цена", accessor: (r) => formatRub(r.item.priceSnapshot) },
  {
    key: "total",
    label: "Всего",
    accessor: (r) => formatRub(r.item.priceSnapshot * r.item.quantity),
  },
  {
    key: "status",
    label: "Статус",
    accessor: (r) =>
      r.item.cancelled ? "Отменено" : ORDER_STATUS_LABELS[r.order.status as OrderStatus],
  },
  {
    key: "deliveryDate",
    label: "Дата поставки",
    accessor: (r) =>
      r.order.deliveryDate ? new Date(r.order.deliveryDate).toLocaleDateString("ru-RU") : "—",
  },
  { key: "paid", label: "Оплата", accessor: (r) => paymentStatusText(r.order) },
];

export function CustomerOrdersTable({ orders }: { orders: OrderWithExtras[] }) {
  const [filters, setFilters] = useState<Record<string, string>>({});

  const rows: Row[] = useMemo(
    () => orders.flatMap((order) => order.items.map((item) => ({ order, item }))),
    [orders]
  );

  const columnOptions = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const column of COLUMNS) {
      map[column.key] = [...new Set(rows.map(column.accessor))].sort((a, b) =>
        a.localeCompare(b, "ru")
      );
    }
    return map;
  }, [rows]);

  const filtered = useMemo(() => {
    const activeFilters = COLUMNS.filter((c) => filters[c.key]?.trim());
    if (activeFilters.length === 0) return rows;
    return rows.filter((row) =>
      activeFilters.every((column) =>
        column.accessor(row).toLowerCase().includes(filters[column.key].trim().toLowerCase())
      )
    );
  }, [rows, filters]);

  if (orders.length === 0) {
    return <p className="text-sm text-foreground/40">У вас пока нет заказов.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-foreground/10 text-left text-foreground/50">
          {COLUMNS.map((column) => (
            <th key={column.key} className="py-2 pr-4">
              {column.label}
            </th>
          ))}
          <th className="py-2 pr-4">Действие</th>
        </tr>
        <tr className="border-b border-foreground/10">
          {COLUMNS.map((column) => (
            <th key={column.key} className="py-1 pr-4 font-normal">
              <SuggestField
                value={filters[column.key] ?? ""}
                onChange={(v) => setFilters((prev) => ({ ...prev, [column.key]: v }))}
                allOptions={columnOptions[column.key]}
                placeholder="Фильтр..."
                panelPositioning="fixed"
              />
            </th>
          ))}
          <th className="py-1 pr-4" />
        </tr>
      </thead>
      <tbody>
        {filtered.length === 0 ? (
          <tr>
            <td colSpan={COLUMNS.length + 1} className="py-6 text-center text-foreground/40">
              Ничего не найдено.
            </td>
          </tr>
        ) : (
          filtered.map(({ order, item }) => (
            <tr key={item.id} className="border-b border-foreground/10">
              <td className="py-2 pr-4 font-medium">{order.orderNumber}</td>
              <td className={`py-2 pr-4 ${item.cancelled ? "text-foreground/40 line-through" : ""}`}>
                {item.nameSnapshot}
              </td>
              <td className="py-2 pr-4">{item.product?.sku ?? "—"}</td>
              <td className="py-2 pr-4">{item.quantity}</td>
              <td className="py-2 pr-4">{formatRub(item.priceSnapshot)}</td>
              <td className="py-2 pr-4">{formatRub(item.priceSnapshot * item.quantity)}</td>
              <td className="py-2 pr-4">
                <OrderStatusBadge status={order.status as OrderStatus} cancelled={item.cancelled} />
              </td>
              <td className="py-2 pr-4">
                {order.deliveryDate
                  ? new Date(order.deliveryDate).toLocaleDateString("ru-RU")
                  : "—"}
              </td>
              <td className="py-2 pr-4">
                <PaymentStatusBadge paid={order.paid} plannedPaymentDate={order.plannedPaymentDate} />
              </td>
              <td className="py-2 pr-4">
                <OrderActionMenu
                  orderId={order.id}
                  orderItemId={item.id}
                  itemsCount={order.items.length}
                  itemCancelled={item.cancelled}
                  latestDocs={order.latestDocs}
                />
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
