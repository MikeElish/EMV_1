"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatAdminPrice } from "@/lib/money";
import { ORDER_STATUS_LABELS, ORDER_STATUS_PROGRESS, SHIPPED_STATUSES } from "@/lib/validators/orders";
import { OrderStatusSelect } from "@/components/admin/OrderStatusSelect";
import { PaidToggle, PAYMENT_STATE_LABELS, paymentStateOf } from "@/components/admin/PaidToggle";
import { DeliveryDateInput } from "@/components/admin/DeliveryDateInput";
import { OrderFilesMenu } from "@/components/admin/OrderFilesMenu";
import { OrderActionsMenu } from "@/components/admin/OrderActionsMenu";
import { NewOrderModal } from "@/components/admin/NewOrderModal";
import { LinePriceCell } from "@/components/admin/LinePriceCell";
import { AddOrderItemModal } from "@/components/admin/AddOrderItemModal";
import { LineQuantityCell } from "@/components/admin/LineQuantityCell";
import { LineBonusCell } from "@/components/admin/LineBonusCell";
import { CrmTableScroll, STICKY_THEAD } from "@/components/admin/CrmTableFrame";
import { DeliveryMethodCell } from "@/components/admin/DeliveryMethodCell";
import { ExtraCostsButton, type ExtraCostRow } from "@/components/admin/ExtraCostsButton";
import { LogisticsRequestModal, type LogisticsSource, type LogisticsLine } from "@/components/admin/LogisticsRequestModal";
import { DELIVERY_METHOD_LABELS, DELIVERY_METHODS } from "@/lib/delivery";
import type { DeliveryMethod, Order, OrderItem, OrderStatus } from "@prisma/client";
import type { PaymentState } from "@/actions/admin/orders";
import { clearLineSurcharge } from "@/actions/admin/orders";
import { useRememberedState } from "@/components/admin/AdminPlaces";
import { OrderManagerSelect, type Employee } from "@/components/admin/OrderManagerSelect";
import { formatOrderLineUnitPrice, orderLineTotal, orderLineUnitPrice } from "@/lib/order-pricing";

type OrderLine = OrderItem & {
  product: { name: string; sku: string; stock: number } | null;
  supplierOrderLines: { price: number; quantity: number; deliveryDays: number | null; purchase: { sentAt: Date | null } | null }[];
};

export type OrderRow = Order & {
  canEdit: boolean;
  items: OrderLine[];
  extraCosts: ExtraCostRow[];
  user: {
    lastName: string | null;
    firstName: string | null;
    patronymic: string | null;
    login: string;
    company: { name: string } | null;
  } | null;
  buyerCompany: { name: string; contract: string | null } | null;
};

type Row = {
  order: OrderRow;
  item: OrderLine;
  customer: string;
  activeLines: number;
  extra: number;
};

/** The company, or the person when not tied to one (guests: the name from checkout). */
function customerOf(order: OrderRow): string {
  if (order.buyerCompany) return order.buyerCompany.name;
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
  extra: string;
  grand: string;
  status: OrderStatus | "";
  delivery: DeliveryMethod | "";
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
  extra: "",
  grand: "",
  status: "",
  delivery: "",
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
  { key: "extra", label: "Доп.расходы" },
  { key: "grand", label: "Маржа" },
];

/** «Не завершённые»: everything but Выполнен and Отменён (shipped and still unpaid counts as open). */
const FINISHED: OrderStatus[] = ["DONE", "CANCELLED"];
const GROUPED_COLUMNS = new Set<keyof Filters>([
  "orderNumber",
  "customer",
  "quantity",
  "total",
  "extra",
  "grand",
]);
const STATUS_ORDER: OrderStatus[] = [...ORDER_STATUS_PROGRESS, "CANCELLED"];
const PAYMENT_ORDER: PaymentState[] = ["unpaid", "deferred", "paid"];

const formatDay = (d: Date) =>
  new Date(d).toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" });

function supplierDeliveryDate(line: OrderLine): Date | null {
  const sol = line.supplierOrderLines[0];
  if (!sol || sol.deliveryDays == null) return line.deliveryDate ?? null;
  const base = sol.purchase?.sentAt ?? new Date();
  return new Date(base.getTime() + sol.deliveryDays * 24 * 60 * 60 * 1000);
}

function linePurchaseCost(line: OrderLine): number {
  return line.supplierOrderLines.reduce((sum, sol) => sum + sol.price * sol.quantity, 0);
}

function orderMargin(order: OrderRow): number {
  const selling = order.items.reduce((sum, item) => sum + orderLineTotal(item), 0);
  const purchase = order.items.reduce((sum, item) => sum + linePurchaseCost(item), 0);
  const extra = order.extraCosts.reduce((sum, c) => sum + c.amount, 0);
  return selling - purchase - extra;
}

function lineMargin(item: OrderLine, order: OrderRow): number {
  const selling = orderLineTotal(item);
  const purchase = linePurchaseCost(item);
  const extra = order.extraCosts.reduce((sum, c) => sum + c.amount, 0);
  const share = order.items.length > 0 ? extra / order.items.length : 0;
  return selling - purchase - share;
}

type OrderGroup = {
  order: OrderRow;
  customer: string;
  extra: number;
  quantity: number;
  status: string;
  delivery: string;
  deliveryPending: boolean;
  dates: string;
  payment: string;
};

/** One order summed up: different values are listed with « / », dates as a range. */
function groupOf(order: OrderRow, customer: string, extra: number): OrderGroup {
  const active = order.items.filter((i) => i.status !== "CANCELLED");
  const lines = active.length ? active : order.items;
  const statuses = STATUS_ORDER.filter((st) => order.items.some((i) => i.status === st));
  const deliveries = DELIVERY_METHODS.filter((m) => lines.some((i) => i.deliveryMethod === m));
  const payments = PAYMENT_ORDER.filter((st) => lines.some((i) => paymentStateOf(i) === st));
  const clientDates = lines
    .map((i) => {
      const supplierDate = supplierDeliveryDate(i);
      if (!supplierDate) return null;
      const d = new Date(supplierDate);
      if (i.deliveryMethod === "ADDRESS" || i.deliveryMethod === "TERMINAL") {
        d.setDate(d.getDate() + (i.deliveryDays || 0));
      }
      return d.getTime();
    })
    .filter((t): t is number => t !== null);
  const min = clientDates.length ? Math.min(...clientDates) : null;
  const max = clientDates.length ? Math.max(...clientDates) : null;
  return {
    order,
    customer,
    extra,
    quantity: active.reduce((sum, i) => sum + i.quantity, 0),
    status: statuses.map((st) => ORDER_STATUS_LABELS[st]).join(" / "),
    delivery: deliveries.map((m) => DELIVERY_METHOD_LABELS[m]).join(" / ") || "—",
    deliveryPending: lines.some((i) => i.deliveryConfirmPending),
    dates:
      min === null || max === null
        ? "—"
        : min === max
          ? formatDay(new Date(min))
          : `${formatDay(new Date(min))} – ${formatDay(new Date(max))}`,
    payment: payments.map((st) => PAYMENT_STATE_LABELS[st]).join(" / "),
  };
}

function toInputValue(date: Date | null): string {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

const filterInputClassName =
  "w-full rounded-md border border-foreground/20 bg-transparent px-2 py-1 text-xs outline-none focus:border-foreground/50";

export function OrdersTable({
  orders,
  initialOrderNumber,
  canDelete = false,
  employees = [],
  manualInputEnabled = false,
  canEditPayment = false,
}: {
  orders: OrderRow[];
  initialOrderNumber?: string;
  /** For «Менеджер» of an order. */
  employees?: Employee[];
  /** Владелец: «Удалить» on every row. */
  canDelete?: boolean;
  manualInputEnabled?: boolean;
  canEditPayment?: boolean;
}) {
  const router = useRouter();
  const [filters, setFilters] = useRememberedState<Filters>(
    "filters",
    { ...EMPTY_FILTERS, orderNumber: initialOrderNumber ?? "" },
    { restore: !initialOrderNumber }
  );
  const [syncedOrderNumber, setSyncedOrderNumber] = useState(initialOrderNumber);
  const [creating, setCreating] = useState(false);
  const [grouped, setGrouped] = useRememberedState("grouped", true);
  const [unfinished, setUnfinished] = useRememberedState("unfinished", true);
  const manual = canDelete && manualInputEnabled;
  const [addingProduct, setAddingProduct] = useState(false);
  const [logisticsSource, setLogisticsSource] = useState<LogisticsSource | null>(null);

  function toggleUnfinished(next: boolean) {
    setUnfinished(next);
  }

  function toggleGrouped(next: boolean) {
    setGrouped(next);
  }

  // Opening an order from the grouped list remembers that list (filters and
  // scroll position) for «Назад».
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingScroll = useRef<number | null>(null);
  const [returnTo, setReturnTo] = useState<{ filters: Filters; scrollTop: number } | null>(null);

  /** From a grouped row to the order's own lines (editable). */
  function openOrder(orderNumber: string, row: HTMLElement) {
    const frame = row.closest<HTMLElement>("[data-crm-scroll]");
    setReturnTo({ filters, scrollTop: frame?.scrollTop ?? 0 });
    setFilters({ ...EMPTY_FILTERS, orderNumber });
    toggleGrouped(false);
  }

  function backToGrouped() {
    if (!returnTo) return;
    pendingScroll.current = returnTo.scrollTop;
    setFilters(returnTo.filters);
    setReturnTo(null);
    toggleGrouped(true);
  }

  function buildOrderLogisticsSource(order: OrderRow): LogisticsSource {
    const activeItems = order.items.filter((i) => !i.cancelled);
    const lines: LogisticsLine[] = activeItems.map((item) => ({
      productId: item.productId,
      brand: null,
      name: item.nameSnapshot,
      sku: item.product?.sku ?? null,
      quantity: item.quantity,
      price: orderLineUnitPrice(item),
    }));
    return {
      kind: "order",
      orderId: order.id,
      counterpartyId: order.buyerCompanyId,
      address: order.deliveryNote ?? null,
      documentKind: "UPD",
      lines,
    };
  }

  // The frame is remounted on a mode switch -- put the list back where it was.
  useLayoutEffect(() => {
    if (pendingScroll.current === null || !scrollRef.current) return;
    scrollRef.current.scrollTop = pendingScroll.current;
    pendingScroll.current = null;
  }, [grouped]);

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
        const extra = order.extraCosts.reduce((sum, c) => sum + c.amount, 0);
        return order.items.map((item) => ({ order, item, customer, activeLines, extra }));
      }),
    [orders]
  );

  const filtered = useMemo(() => {
    const has = (value: string, query: string) =>
      value.toLowerCase().includes(query.trim().toLowerCase());
    return rows.filter(({ order, item, customer, extra }) => {
      if (unfinished && FINISHED.includes(order.status)) return false;
      if (filters.orderNumber && !has(order.orderNumber, filters.orderNumber)) return false;
      if (filters.customer && !has(customer, filters.customer)) return false;
      if (filters.itemName && !has(item.nameSnapshot, filters.itemName)) return false;
      if (filters.sku && !has(item.product?.sku ?? "", filters.sku)) return false;
      if (!grouped && filters.quantity && !has(String(item.quantity), filters.quantity))
        return false;
      if (filters.inStock && !has(String(item.product?.stock ?? ""), filters.inStock)) return false;
      if (filters.price && !has(String(orderLineUnitPrice(item) / 100), filters.price)) return false;
      if (filters.total && !has(String((grouped ? order.totalAmount : orderLineTotal(item)) / 100), filters.total))
        return false;
      if (filters.extra && !has(String(extra / 100), filters.extra)) return false;
      const margin = grouped ? orderMargin(order) : lineMargin(item, order);
      if (filters.grand && !has(String(margin / 100), filters.grand)) return false;
      if (filters.status && item.status !== filters.status) return false;
      if (filters.delivery && item.deliveryMethod !== filters.delivery) return false;
      if (filters.deliveryDate) {
        const supplierDate = supplierDeliveryDate(item);
        if (!supplierDate) return false;
        const clientDate = new Date(supplierDate);
        if (item.deliveryMethod === "ADDRESS" || item.deliveryMethod === "TERMINAL") {
          clientDate.setDate(clientDate.getDate() + (item.deliveryDays || 0));
        }
        if (toInputValue(clientDate) !== filters.deliveryDate) return false;
      }
      if (filters.paid && paymentStateOf(item) !== filters.paid) return false;
      return true;
    });
  }, [rows, filters, grouped, unfinished]);

  // An order is listed when any of its lines passes the filters; the row sums
  // up all of its lines.
  const groups = useMemo(() => {
    if (!grouped) return [];
    const seen = new Set<string>();
    const result: OrderGroup[] = [];
    for (const row of filtered) {
      if (seen.has(row.order.id)) continue;
      seen.add(row.order.id);
      const group = groupOf(row.order, row.customer, row.extra);
      if (filters.quantity && !String(group.quantity).includes(filters.quantity.trim())) continue;
      result.push(group);
    }
    return result;
  }, [grouped, filtered, filters.quantity]);

  const showBonusColumn = useMemo(
    () =>
      manual ||
      filtered.some(
        ({ order, item }) =>
          order.invoiceRef && !SHIPPED_STATUSES.includes(item.status) && order.canEdit,
      ),
    [manual, filtered],
  );

  const textFilters = grouped
    ? TEXT_FILTERS.filter((f) => GROUPED_COLUMNS.has(f.key))
    : TEXT_FILTERS;

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
          <label className="ml-4 flex cursor-pointer items-center gap-2 text-sm text-foreground/70">
            <input
              type="checkbox"
              checked={grouped}
              onChange={(e) => {
                setReturnTo(null);
                toggleGrouped(e.target.checked);
              }}
            />
            Группировать по заказам
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground/70">
            <input type="checkbox" checked={unfinished} onChange={(e) => toggleUnfinished(e.target.checked)} />
            Не завершённые
          </label>
          {returnTo && !grouped && (
            <button
              type="button"
              onClick={backToGrouped}
              className="inline-flex items-center gap-1.5 rounded-md border border-foreground/20 px-3 py-1 text-sm font-medium transition-colors hover:bg-foreground/5"
            >
              <span aria-hidden>←</span> Назад
            </button>
          )}
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="ml-auto text-sm text-foreground/50 hover:text-foreground"
          >
            Сбросить фильтры
          </button>
        )}
        {manual && (
          <button
            type="button"
            onClick={() => setAddingProduct(true)}
            className="ml-2 rounded-md border border-foreground/20 px-2 py-1 text-sm hover:bg-foreground/5"
          >
            + Товар в заказ
          </button>
        )}
      </div>

      {creating && <NewOrderModal onClose={() => setCreating(false)} />}
{addingProduct && (
  <AddOrderItemModal
    orders={orders.map((o) => ({ id: o.id, orderNumber: o.orderNumber }))}
    onClose={() => setAddingProduct(false)}
  />
)}
      {logisticsSource && <LogisticsRequestModal source={logisticsSource} onClose={() => setLogisticsSource(null)} />}

      {orders.length === 0 ? (
        <p className="mt-4 text-sm text-foreground/40">Заказов пока нет.</p>
      ) : (
        <CrmTableScroll ref={scrollRef} key={grouped ? "grouped" : "lines" /* new scale for the other layout */}>
          <table className="w-full text-sm">
            <thead className={STICKY_THEAD}>
              <tr className="text-left text-foreground/50">
                {textFilters.map((f) => (
                  <th key={f.key} className="py-2 pr-4">
                    {f.label}
                  </th>
                ))}
                <th className="py-2 pr-4">Статус</th>
                <th className="py-2 pr-4">Доставка</th>
                <th className="py-2 pr-4">Дата поставки</th>
                <th className="py-2 pr-4">Оплата</th>
                {!grouped && showBonusColumn && <th className="py-2 pr-4">Бонус</th>}
                {!grouped && <th className="py-2 pr-4">Файлы</th>}
                {!grouped && <th className="py-2 pr-4">Действие</th>}
              </tr>
              <tr className="text-left">
                {textFilters.map((f) => (
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
                  <select
                    value={filters.delivery}
                    onChange={(e) => setFilter("delivery", e.target.value as DeliveryMethod | "")}
                    className={`${filterInputClassName} bg-background`}
                  >
                    <option value="">Все</option>
                    {DELIVERY_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {DELIVERY_METHOD_LABELS[m]}
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
                {!grouped && showBonusColumn && <th className="pb-2 pr-4" />}
                {!grouped && <th className="pb-2 pr-4" />}
                {!grouped && <th className="pb-2 pr-4" />}
              </tr>
            </thead>
            {grouped ? (
              <tbody>
                {groups.length === 0 ? (
                  <tr>
                    <td
                      colSpan={textFilters.length + 4}
                      className="py-4 text-sm text-foreground/40"
                    >
                      Ничего не найдено.
                    </td>
                  </tr>
                ) : (
                  groups.map((g) => (
                    <tr
                      key={g.order.id}
                      onClick={(e) => openOrder(g.order.orderNumber, e.currentTarget)}
                      title="Открыть позиции заказа"
                      className="cursor-pointer border-b border-foreground/10 transition-colors hover:bg-foreground/5"
                    >
                      <td className="whitespace-nowrap py-2 pr-4 font-medium">
                        {g.order.orderNumber}
                      </td>
                      <td className="py-2 pr-4">
                        {g.customer}
                        {g.order.managerId && (
                          <div className="text-xs text-foreground/50">{employees.find((e) => e.id === g.order.managerId)?.name}</div>
                        )}
                      </td>
                      <td className="py-2 pr-4">{g.quantity}</td>
                      <td className="whitespace-nowrap py-2 pr-4">
                        {formatAdminPrice(g.order.totalAmount)}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-4">{formatAdminPrice(g.extra)}</td>
                      <td className="whitespace-nowrap py-2 pr-4 font-medium">
                        {formatAdminPrice(orderMargin(g.order))}
                      </td>
                      <td className="py-2 pr-4">{g.status}</td>
                      <td className="py-2 pr-4">
                        {g.delivery}
                        {g.deliveryPending && (
                          <div className="whitespace-nowrap text-[11px] text-yellow-700 dark:text-yellow-400">
                            Ждёт подтверждения покупателя
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-4">{g.dates}</td>
                      <td className="py-2 pr-4">{g.payment}</td>
                      <td className="py-2 pr-4">
                        <OrderActionsMenu
                          order={g.order}
                          managerName={employees.find((e) => e.id === g.order.managerId)?.name ?? "не назначен"}
                          onLogistics={() => setLogisticsSource(buildOrderLogisticsSource(g.order))}
                          canDelete={canDelete && manualInputEnabled}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            ) : (
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={TEXT_FILTERS.length + 5 + (showBonusColumn ? 1 : 0)}
                      className="py-4 text-sm text-foreground/40"
                    >
                      Ничего не найдено.
                    </td>
                  </tr>
                ) : (
                  filtered.map(({ order, item, customer, activeLines, extra }) => {
                    const cancelledCellClass = item.cancelled
                      ? "text-foreground/40 line-through"
                      : "";
                    const short =
                      item.product && !item.cancelled && item.product.stock < item.quantity;
                    return (
                      <tr key={item.id} className="border-b border-foreground/10">
                        <td className="whitespace-nowrap py-2 pr-4 font-medium">
                          {order.orderNumber}
                        </td>
                        <td className="py-2 pr-4">
                          {customer}
                          {/* Once per order: its first line. */}
                          {order.items[0]?.id === item.id &&
                            (canDelete ? (
                              <OrderManagerSelect orderId={order.id} managerId={order.managerId} employees={employees} />
                            ) : (
                              <div className="mt-1 text-xs text-foreground/50">
                                Менеджер: {employees.find((employee) => employee.id === order.managerId)?.name ?? "не назначен"}
                              </div>
                            ))}
                        </td>
                        <td className={`py-2 pr-4 ${cancelledCellClass}`}>{item.product?.name ?? item.nameSnapshot}</td>
                        <td className={`py-2 pr-4 ${cancelledCellClass}`}>
                          {item.product?.sku ?? "—"}
                        </td>
                        <td className={`py-2 pr-4 ${cancelledCellClass}`}>
  {manual && !item.cancelled ? <LineQuantityCell itemId={item.id} current={item.quantity} /> : item.quantity}
</td>
                        <td
                          className={`py-2 pr-4 ${short ? "text-red-600 dark:text-red-500" : ""}`}
                          title={short ? "Меньше, чем заказано" : undefined}
                        >
                          {item.product?.stock ?? "—"}
                        </td>
                        <td className={`py-2 pr-4 ${cancelledCellClass}`}>
                          {order.canEdit && manual && !item.cancelled ? (
                            <LinePriceCell itemId={item.id} current={item.priceSnapshot - item.surcharge} />
                          ) : order.canEdit && item.priceSnapshot <= 0 && !item.cancelled ? (
                            <LinePriceCell itemId={item.id} />
                          ) : item.bonus > 0 ? (
                            formatOrderLineUnitPrice(item)
                          ) : (
                            formatAdminPrice(item.priceSnapshot)
                          )}
                          {item.surcharge > 0 && !item.cancelled && (
                            <div
                              className="flex items-center gap-1 whitespace-nowrap text-xs text-foreground/50"
                              title="Заказ «Под заказ» меньше 10 000 ₽ — +1 500 ₽; маржа меньше 2 000 ₽ — до 2 500 ₽; поровну на позиции «Под заказ»"
                            >
                              <span>
                                {manual ? "+ " : "в т.ч. "}надбавка {formatAdminPrice(item.surcharge)}
                              </span>
                              {manual && order.canEdit && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!confirm("Убрать надбавку у позиции?")) return;
                                    clearLineSurcharge(item.id).then((r) => {
                                      if (!r.ok) alert(r.error);
                                      else router.refresh();
                                    });
                                  }}
                                  className="text-red-600 hover:opacity-70"
                                  aria-label="Убрать надбавку"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        <td className={`whitespace-nowrap py-2 pr-4 ${cancelledCellClass}`}>
                          {formatAdminPrice(orderLineTotal(item))}
                        </td>
                        <td className="whitespace-nowrap py-2 pr-4">
                          <ExtraCostsButton
                            orderNumber={order.orderNumber}
                            costs={order.extraCosts}
                            total={extra}
                          />
                        </td>
                        <td className="whitespace-nowrap py-2 pr-4 font-medium">
                          {formatAdminPrice(lineMargin(item, order))}
                        </td>
                        <td className="py-2 pr-4">
                          {order.canEdit ? (
                            <OrderStatusSelect
                              itemId={item.id}
                              status={item.status}
                              activeLines={activeLines}
                            />
                          ) : (
                            ORDER_STATUS_LABELS[item.status]
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          {order.canEdit ? (
                            <DeliveryMethodCell
                              itemId={item.id}
                              method={item.deliveryMethod}
                              days={item.deliveryDays}
                              confirmPending={item.deliveryConfirmPending}
                              activeLines={activeLines}
                            />
                          ) : (
                            <>
                              {item.deliveryMethod ? DELIVERY_METHOD_LABELS[item.deliveryMethod] : "—"}
                              {item.deliveryConfirmPending && <div className="mt-1 text-xs text-amber-700">Ждёт подтверждения</div>}
                            </>
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          <DeliveryDateInput
                            supplierDate={supplierDeliveryDate(item)}
                            deliveryDays={item.deliveryDays}
                            needsDelivery={item.deliveryMethod === "ADDRESS" || item.deliveryMethod === "TERMINAL"}
                          />
                        </td>
                        <td className="py-2 pr-4">
                          {order.canEdit ? (
                            <PaidToggle
                              itemId={item.id}
                              state={paymentStateOf(item)}
                              activeLines={activeLines}
                              canEdit={canEditPayment}
                            />
                          ) : (
                            PAYMENT_STATE_LABELS[paymentStateOf(item)]
                          )}
                        </td>
                        {(manual || (order.invoiceRef && !SHIPPED_STATUSES.includes(item.status))) && (
                          <td className="py-2 pr-4">
                            {!item.cancelled && order.canEdit && <LineBonusCell itemId={item.id} bonus={item.bonus} />}
                          </td>
                        )}
                        <td className="py-2 pr-4">
                          <OrderFilesMenu
                            orderId={order.id}
                            canEdit={order.canEdit}
                            deferred={order.deferred}
                            contract={order.buyerCompany?.contract ?? null}
                          />
                        </td>
                        {!grouped && (
                          <td className="py-2 pr-4">
                            <OrderActionsMenu
                              order={order}
                              itemId={item.id}
                              managerName={employees.find((e) => e.id === order.managerId)?.name ?? "не назначен"}
                              onLogistics={() => setLogisticsSource(buildOrderLogisticsSource(order))}
                              canDelete={canDelete && manualInputEnabled}
                            />
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            )}
          </table>
        </CrmTableScroll>
      )}
    </>
  );
}
