"use client";

import { useMemo, useState } from "react";
import { formatRub } from "@/lib/money";
import { ORDER_STATUS_LABELS } from "@/lib/validators/orders";
import { getPaymentDisplayStatus } from "@/lib/validators/payment-status";
import { OrderActionMenu, type LatestDocs } from "@/components/shop/OrderActionMenu";
import { OrderStatusBadge } from "@/components/shop/OrderStatusBadge";
import { PaymentStatusBadge } from "@/components/shop/PaymentStatusBadge";
import { SuggestField } from "@/components/SuggestField";
import { DeliveryConfirmCell } from "@/components/shop/DeliveryConfirmCell";
import { DELIVERY_METHOD_LABELS } from "@/lib/delivery";
import type { Order, OrderItem } from "@prisma/client";

// Payment is per line; the planned payment date belongs to the order.
function paymentStatusText(item: Pick<OrderItem, "paid" | "deferred">, order: Pick<Order, "plannedPaymentDate">): string {
  const status = getPaymentDisplayStatus({ ...item, plannedPaymentDate: order.plannedPaymentDate });
  if (status.kind === "paid") return "Оплачено";
  if (status.kind === "unpaid") return "Не оплачено";
  if (status.kind === "agreed") return "Отсрочка";
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
    accessor: (r) => ORDER_STATUS_LABELS[r.item.status],
  },
  {
    key: "delivery",
    label: "Доставка",
    accessor: (r) =>
      (r.item.deliveryMethod ? DELIVERY_METHOD_LABELS[r.item.deliveryMethod] : "—") +
      (r.item.deliveryConfirmPending ? " (требуется подтверждение)" : ""),
  },
  {
    key: "deliveryDate",
    label: "Дата поставки",
    accessor: (r) =>
      r.item.deliveryDate ? new Date(r.item.deliveryDate).toLocaleDateString("ru-RU") : "—",
  },
  { key: "paid", label: "Оплата", accessor: (r) => paymentStatusText(r.item, r.order) },
];

export function CustomerOrdersTable({
  orders,
  initialOrderNumber,
}: {
  orders: OrderWithExtras[];
  /** From ?orderNumber= -- the link in the status letters. */
  initialOrderNumber?: string;
}) {
  const [filters, setFilters] = useState<Record<string, string>>(
    initialOrderNumber ? { orderNumber: initialOrderNumber } : {}
  );

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

  // Phones: one search over every column instead of a filter per column.
  const [query, setQuery] = useState("");
  const found = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? rows.filter((row) => COLUMNS.some((c) => c.accessor(row).toLowerCase().includes(q))) : rows;
    const byOrder = new Map<string, Row[]>();
    for (const row of list) byOrder.set(row.order.id, [...(byOrder.get(row.order.id) ?? []), row]);
    return [...byOrder.values()];
  }, [rows, query]);

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
    <>
    <div className="space-y-4 sm:hidden">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Поиск: номер заказа, товар, артикул, статус"
        className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-foreground/50"
      />
      {found.length === 0 && <p className="py-6 text-center text-sm text-foreground/40">Ничего не найдено.</p>}
      {found.map((lines) => {
        const order = lines[0].order;
        return (
          <section key={order.id} className="rounded-lg border border-foreground/15">
            <h2 className="flex items-baseline justify-between gap-3 border-b border-foreground/10 px-4 py-3">
              <span className="font-semibold">Заказ {order.orderNumber}</span>
              <span className="text-xs text-foreground/50">
                {new Date(order.createdAt).toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" })}
              </span>
            </h2>
            {lines.map(({ item }) => (
              <div key={item.id} className="space-y-2 border-b border-foreground/10 px-4 py-3 text-sm last:border-b-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={item.cancelled ? "text-foreground/40 line-through" : "font-medium"}>{item.nameSnapshot}</p>
                    <p className="text-xs text-foreground/50">{item.product?.sku ?? "—"}</p>
                  </div>
                  <OrderActionMenu
                    orderId={order.id}
                    orderItemId={item.id}
                    itemsCount={order.items.length}
                    itemCancelled={item.cancelled}
                    latestDocs={order.latestDocs}
                  />
                </div>
                <p className="text-foreground/70">
                  {item.quantity} × {formatRub(item.priceSnapshot)} ={" "}
                  <span className="font-medium text-foreground">{formatRub(item.priceSnapshot * item.quantity)}</span>
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <OrderStatusBadge status={item.status} />
                  <PaymentStatusBadge paid={item.paid} deferred={item.deferred} plannedPaymentDate={order.plannedPaymentDate} />
                </div>
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-foreground/70">
                  <span className="text-foreground/50">Доставка</span>
                  <DeliveryConfirmCell
                    itemId={item.id}
                    method={item.deliveryMethod}
                    pending={item.deliveryConfirmPending}
                    otherPending={order.items.filter((i) => i.id !== item.id && i.deliveryConfirmPending).length}
                  />
                  <span className="text-foreground/50">Дата поставки</span>
                  <span>{item.deliveryDate ? new Date(item.deliveryDate).toLocaleDateString("ru-RU") : "—"}</span>
                </div>
              </div>
            ))}
          </section>
        );
      })}
    </div>
    <table className="hidden w-full text-sm sm:table">
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
                <OrderStatusBadge status={item.status} />
              </td>
              <td className="py-2 pr-4">
                <DeliveryConfirmCell
                  itemId={item.id}
                  method={item.deliveryMethod}
                  pending={item.deliveryConfirmPending}
                  otherPending={order.items.filter((i) => i.id !== item.id && i.deliveryConfirmPending).length}
                />
              </td>
              <td className="py-2 pr-4">
                {item.deliveryDate
                  ? new Date(item.deliveryDate).toLocaleDateString("ru-RU")
                  : "—"}
              </td>
              <td className="py-2 pr-4">
                <PaymentStatusBadge
                  paid={item.paid}
                  deferred={item.deferred}
                  plannedPaymentDate={order.plannedPaymentDate}
                />
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
    </>
  );
}
