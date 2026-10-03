"use client";

import { useMemo, useState } from "react";
import { formatRub } from "@/lib/money";
import { ORDER_STATUS_LABELS } from "@/lib/validators/orders";
import { OrderStatusSelect } from "@/components/admin/OrderStatusSelect";
import { PaidToggle, PAYMENT_STATE_LABELS, paymentStateOf } from "@/components/admin/PaidToggle";
import { DeliveryDateInput } from "@/components/admin/DeliveryDateInput";
import { OrderFilesMenu } from "@/components/admin/OrderFilesMenu";
import { NewOrderModal } from "@/components/admin/NewOrderModal";
import { CrmTableScroll, STICKY_THEAD } from "@/components/admin/CrmTableFrame";
import type { Order, OrderItem, OrderStatus } from "@prisma/client";
import type { PaymentState } from "@/actions/admin/orders";

type OrderLine = OrderItem & { product: { sku: string; stock: number } | null };

export type OrderRow = Order & {
  items: OrderLine[];
  user: {
    lastName: string | null;
    firstName: string | null;
    patronymic: string | null;
    login: string;
    company: { name: string } | null;
  } | null;
};

type Row = {
  order: OrderRow;
  item: OrderLine;
  customer: string;
  activeLines: number;
};

/** The company, or the person when not tied to one (guests: the name from checkout). */
function customerOf(order: OrderRow): string {
  if (order.user?.company) return order.user.company.name;
  if (order.user) {
    const name = [order.user.lastName, order.user.firstName, order.user.patronymic]
      .filter(Boolean)
      .join(" ");
    return name || order.user.login;
  }
  return order.customerName;
}

type Filters = {
  orderNumber: string;
  customer: string;
  itemName: string;
  sku: string;
  quantity: string;
  inStock: string;
  price: string;
  total: string;
  status: OrderStatus | "";
  deliveryDate: string;
  paid: PaymentState | "";
};

const EMPTY_FILTERS: Filters = {
  orderNumber: "",
  customer: "",
  itemName: "",
  sku: "",
  quantity: "",
  inStock: "",
  price: "",
  total: "",
  status: "",
  deliveryDate: "",
  paid: "",
};

const TEXT_FILTERS: { key: keyof Filters; label: string }[] = [
  { key: "orderNumber", label: "Номер заказа" },
  { key: "customer", label: "Заказчик" },
  { key: "itemName", label: "Наименование товара" },
  { key: "sku", label: "Артикул" },
  { key: "quantity", label: "Количество" },
  { key: "inStock", label: "В наличии" },
  { key: "price", label: "Цена" },
  { key: "total", label: "Всего" },
];

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
  orders: OrderRow[];
  initialOrderNumber?: string;
}) {
  const [filters, setFilters] = useState<Filters>({
    ...EMPTY_FILTERS,
    orderNumber: initialOrderNumber ?? "",
  });
  const [syncedOrderNumber, setSyncedOrderNumber] = useState(initialOrderNumber);
  const [creating, setCreating] = useState(false);

  if (initialOrderNumber !== syncedOrderNumber) {
    setSyncedOrderNumber(initialOrderNumber);
    setFilters((prev) => ({ ...prev, orderNumber: initialOrderNumber ?? "" }));
  }

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  const rows: Row[] = useMemo(
    () =>
      orders.flatMap((order) => {
        const customer = customerOf(order);
        const activeLines = order.items.filter((i) => i.status !== "CANCELLED").length;
        return order.items.map((item) => ({ order, item, customer, activeLines }));
      }),
    [orders]
  );

  const filtered = useMemo(() => {
    const has = (value: string, query: string) => value.toLowerCase().includes(query.trim().toLowerCase());
    return rows.filter(({ order, item, customer }) => {
      if (filters.orderNumber && !has(order.orderNumber, filters.orderNumber)) return false;
      if (filters.customer && !has(customer, filters.customer)) return false;
      if (filters.itemName && !has(item.nameSnapshot, filters.itemName)) return false;
      if (filters.sku && !has(item.product?.sku ?? "", filters.sku)) return false;
      if (filters.quantity && !has(String(item.quantity), filters.quantity)) return false;
      if (filters.inStock && !has(String(item.product?.stock ?? ""), filters.inStock)) return false;
      if (filters.price && !has(String(item.priceSnapshot / 100), filters.price)) return false;
      if (filters.total && !has(String(order.totalAmount / 100), filters.total)) return false;
      if (filters.status && item.status !== filters.status) return false;
      if (filters.deliveryDate && toInputValue(order.deliveryDate) !== filters.deliveryDate) return false;
      if (filters.paid && paymentStateOf(order) !== filters.paid) return false;
      return true;
    });
  }, [rows, filters]);

  const hasActiveFilters = Object.values(filters).some(Boolean);

  return (
    <>
      <div className="flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCreating(true)}
            aria-label="Создать заказ"
            className="flex h-8 w-8 items-center justify-center rounded-md bg-green-600 text-lg font-bold leading-none text-white transition-opacity hover:opacity-90"
          >
            +
          </button>
          <h1 className="text-lg font-semibold">Заказы</h1>
        </div>
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

      {creating && <NewOrderModal onClose={() => setCreating(false)} />}

      {orders.length === 0 ? (
        <p className="mt-4 text-sm text-foreground/40">Заказов пока нет.</p>
      ) : (
        <CrmTableScroll>
          <table className="w-full text-sm">
            <thead className={STICKY_THEAD}>
              <tr className="text-left text-foreground/50">
                {TEXT_FILTERS.map((f) => (
                  <th key={f.key} className="py-2 pr-4">
                    {f.label}
                  </th>
                ))}
                <th className="py-2 pr-4">Статус</th>
                <th className="py-2 pr-4">Дата поставки</th>
                <th className="py-2 pr-4">Оплата</th>
                <th className="py-2 pr-4">Файлы</th>
              </tr>
              <tr className="text-left">
                {TEXT_FILTERS.map((f) => (
                  <th key={f.key} className="pb-2 pr-4">
                    <input
                      type="text"
                      value={filters[f.key]}
                      onChange={(e) => setFilter(f.key, e.target.value as never)}
                      placeholder="Поиск..."
                      className={filterInputClassName}
                    />
                  </th>
                ))}
                <th className="pb-2 pr-4">
                  <select
                    value={filters.status}
                    onChange={(e) => setFilter("status", e.target.value as OrderStatus | "")}
                    className={`${filterInputClassName} bg-background`}
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
                    className={`${filterInputClassName} bg-background`}
                  >
                    <option value="">Все</option>
                    {Object.entries(PAYMENT_STATE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </th>
                <th className="pb-2 pr-4" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={TEXT_FILTERS.length + 4} className="py-4 text-sm text-foreground/40">
                    Ничего не найдено.
                  </td>
                </tr>
              ) : (
                filtered.map(({ order, item, customer, activeLines }) => {
                  const cancelledCellClass = item.cancelled ? "text-foreground/40 line-through" : "";
                  const short = item.product && !item.cancelled && item.product.stock < item.quantity;
                  return (
                    <tr key={item.id} className="border-b border-foreground/10">
                      <td className="whitespace-nowrap py-2 pr-4 font-medium">{order.orderNumber}</td>
                      <td className="py-2 pr-4">{customer}</td>
                      <td className={`py-2 pr-4 ${cancelledCellClass}`}>{item.nameSnapshot}</td>
                      <td className={`py-2 pr-4 ${cancelledCellClass}`}>{item.product?.sku ?? "—"}</td>
                      <td className={`py-2 pr-4 ${cancelledCellClass}`}>{item.quantity}</td>
                      <td
                        className={`py-2 pr-4 ${short ? "text-red-600 dark:text-red-500" : ""}`}
                        title={short ? "Меньше, чем заказано" : undefined}
                      >
                        {item.product?.stock ?? "—"}
                      </td>
                      <td className={`py-2 pr-4 ${cancelledCellClass}`}>{formatRub(item.priceSnapshot)}</td>
                      <td className="py-2 pr-4">{formatRub(order.totalAmount)}</td>
                      <td className="py-2 pr-4">
                        <OrderStatusSelect itemId={item.id} status={item.status} activeLines={activeLines} />
                      </td>
                      <td className="py-2 pr-4">
                        <DeliveryDateInput orderId={order.id} deliveryDate={order.deliveryDate} />
                      </td>
                      <td className="py-2 pr-4">
                        <PaidToggle orderId={order.id} state={paymentStateOf(order)} />
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
        </CrmTableScroll>
      )}
    </>
  );
}
