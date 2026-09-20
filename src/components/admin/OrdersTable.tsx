"use client";

import { useMemo, useState } from "react";
import { formatRub } from "@/lib/money";
import { ORDER_STATUS_LABELS } from "@/lib/validators/orders";
import { OrderStatusSelect } from "@/components/admin/OrderStatusSelect";
import { PaidToggle } from "@/components/admin/PaidToggle";
import { DeliveryDateInput } from "@/components/admin/DeliveryDateInput";
import { OrderFilesMenu } from "@/components/admin/OrderFilesMenu";
import type { Order, OrderItem, OrderStatus } from "@prisma/client";

type Row = {
  order: Order;
  item: OrderItem & { product: { sku: string } | null };
};

type Filters = {
  orderNumber: string;
  itemName: string;
  sku: string;
  quantity: string;
  price: string;
  total: string;
  status: OrderStatus | "";
  deliveryDate: string;
  paid: "" | "yes" | "no";
};

const EMPTY_FILTERS: Filters = {
  orderNumber: "",
  itemName: "",
  sku: "",
  quantity: "",
  price: "",
  total: "",
  status: "",
  deliveryDate: "",
  paid: "",
};

function toInputValue(date: Date | null): string {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

const filterInputClassName =
  "w-full rounded-md border border-foreground/20 bg-transparent px-2 py-1 text-xs outline-none focus:border-foreground/50";

export function OrdersTable({
  orders,
  initialOrderNumber,
}: {
  orders: (Order & { items: (OrderItem & { product: { sku: string } | null })[] })[];
  initialOrderNumber?: string;
}) {
  const [filters, setFilters] = useState<Filters>({
    ...EMPTY_FILTERS,
    orderNumber: initialOrderNumber ?? "",
  });
  const [syncedOrderNumber, setSyncedOrderNumber] = useState(initialOrderNumber);

  if (initialOrderNumber !== syncedOrderNumber) {
    setSyncedOrderNumber(initialOrderNumber);
    setFilters((prev) => ({ ...prev, orderNumber: initialOrderNumber ?? "" }));
  }

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  const rows: Row[] = useMemo(
    () => orders.flatMap((order) => order.items.map((item) => ({ order, item }))),
    [orders]
  );

  const filtered = useMemo(() => {
    return rows.filter(({ order, item }) => {
      if (
        filters.orderNumber &&
        !order.orderNumber.toLowerCase().includes(filters.orderNumber.toLowerCase())
      )
        return false;
      if (filters.itemName && !item.nameSnapshot.toLowerCase().includes(filters.itemName.toLowerCase()))
        return false;
      if (filters.sku && !(item.product?.sku ?? "").toLowerCase().includes(filters.sku.toLowerCase()))
        return false;
      if (filters.quantity && !String(item.quantity).includes(filters.quantity.trim())) return false;
      if (filters.price && !String(item.priceSnapshot / 100).includes(filters.price.trim())) return false;
      if (filters.total && !String(order.totalAmount / 100).includes(filters.total.trim())) return false;
      if (filters.status && order.status !== filters.status) return false;
      if (filters.deliveryDate && toInputValue(order.deliveryDate) !== filters.deliveryDate) return false;
      if (filters.paid === "yes" && !order.paid) return false;
      if (filters.paid === "no" && order.paid) return false;
      return true;
    });
  }, [rows, filters]);

  const hasActiveFilters = Object.values(filters).some(Boolean);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Заказы</h1>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="text-sm text-foreground/50 hover:text-foreground"
          >
            Сбросить фильтры
          </button>
        )}
      </div>

      {orders.length === 0 ? (
        <p className="mt-4 text-sm text-foreground/40">Заказов пока нет.</p>
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
            <tr className="border-b border-foreground/10 text-left">
              <th className="pb-2 pr-4">
                <input
                  type="text"
                  value={filters.orderNumber}
                  onChange={(e) => setFilter("orderNumber", e.target.value)}
                  placeholder="Поиск..."
                  className={filterInputClassName}
                />
              </th>
              <th className="pb-2 pr-4">
                <input
                  type="text"
                  value={filters.itemName}
                  onChange={(e) => setFilter("itemName", e.target.value)}
                  placeholder="Поиск..."
                  className={filterInputClassName}
                />
              </th>
              <th className="pb-2 pr-4">
                <input
                  type="text"
                  value={filters.sku}
                  onChange={(e) => setFilter("sku", e.target.value)}
                  placeholder="Поиск..."
                  className={filterInputClassName}
                />
              </th>
              <th className="pb-2 pr-4">
                <input
                  type="text"
                  value={filters.quantity}
                  onChange={(e) => setFilter("quantity", e.target.value)}
                  placeholder="Поиск..."
                  className={filterInputClassName}
                />
              </th>
              <th className="pb-2 pr-4">
                <input
                  type="text"
                  value={filters.price}
                  onChange={(e) => setFilter("price", e.target.value)}
                  placeholder="Поиск..."
                  className={filterInputClassName}
                />
              </th>
              <th className="pb-2 pr-4">
                <input
                  type="text"
                  value={filters.total}
                  onChange={(e) => setFilter("total", e.target.value)}
                  placeholder="Поиск..."
                  className={filterInputClassName}
                />
              </th>
              <th className="pb-2 pr-4">
                <select
                  value={filters.status}
                  onChange={(e) => setFilter("status", e.target.value as OrderStatus | "")}
                  className={filterInputClassName}
                >
                  <option value="">Все</option>
                  {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </th>
              <th className="pb-2 pr-4">
                <input
                  type="date"
                  value={filters.deliveryDate}
                  onChange={(e) => setFilter("deliveryDate", e.target.value)}
                  className={filterInputClassName}
                />
              </th>
              <th className="pb-2 pr-4">
                <select
                  value={filters.paid}
                  onChange={(e) => setFilter("paid", e.target.value as Filters["paid"])}
                  className={filterInputClassName}
                >
                  <option value="">Все</option>
                  <option value="yes">Оплачено</option>
                  <option value="no">Не оплачено</option>
                </select>
              </th>
              <th className="pb-2 pr-4" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-4 text-sm text-foreground/40">
                  Ничего не найдено.
                </td>
              </tr>
            ) : (
              filtered.map(({ order, item }) => {
                const cancelledCellClass = item.cancelled ? "text-foreground/40 line-through" : "";
                return (
                  <tr key={item.id} className="border-b border-foreground/10">
                    <td className="py-2 pr-4 font-medium">{order.orderNumber}</td>
                    <td className={`py-2 pr-4 ${cancelledCellClass}`}>{item.nameSnapshot}</td>
                    <td className={`py-2 pr-4 ${cancelledCellClass}`}>{item.product?.sku ?? "—"}</td>
                    <td className={`py-2 pr-4 ${cancelledCellClass}`}>{item.quantity}</td>
                    <td className={`py-2 pr-4 ${cancelledCellClass}`}>{formatRub(item.priceSnapshot)}</td>
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
                );
              })
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
