"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import type { SupplierOrderStatus } from "@prisma/client";
import { exportSupplierOrders, updateSupplierOrderDays, updateSupplierOrderStatus } from "@/actions/admin/supplier-orders";
import { SUPPLIER_ORDER_STATUS_LABELS } from "@/lib/validators/supplier-orders";
import { CrmTableScroll, STICKY_THEAD } from "@/components/admin/CrmTableFrame";
import { SheetExportButton } from "@/components/admin/SheetExportButton";
import { SupplierOrderDeleteButton } from "@/components/admin/SupplierOrderDeleteButton";

export type SupplierOrderRow = {
  id: string;
  orderNumber: string | null;
  productId: string;
  brand: string | null;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  supplier: string | null;
  deliveryDays: number | null;
  quality: string | null;
  status: SupplierOrderStatus;
};

type Filters = {
  orderNumber: string;
  brand: string;
  name: string;
  sku: string;
  quantity: string;
  supplier: string;
  days: string;
  quality: string;
  status: SupplierOrderStatus | "";
};
const EMPTY: Filters = {
  orderNumber: "",
  brand: "",
  name: "",
  sku: "",
  quantity: "",
  supplier: "",
  days: "",
  quality: "",
  status: "",
};
type TextKey = Exclude<keyof Filters, "status">;

const days = (n: number | null) => (n === null ? "—" : `${n} дн.`);
const TEXT_COLUMNS: { key: TextKey; label: string; get: (r: SupplierOrderRow) => string }[] = [
  { key: "orderNumber", label: "№ заказа", get: (r) => r.orderNumber ?? "" },
  { key: "brand", label: "Бренд", get: (r) => r.brand ?? "" },
  { key: "name", label: "Наименование", get: (r) => r.name },
  { key: "sku", label: "Артикул", get: (r) => r.sku },
  { key: "quantity", label: "Количество", get: (r) => String(r.quantity) },
  { key: "supplier", label: "Поставщик", get: (r) => r.supplier ?? "" },
  { key: "days", label: "Срок поставки", get: (r) => days(r.deliveryDays) },
  { key: "quality", label: "Качество", get: (r) => r.quality ?? "" },
];
const STATUSES = Object.keys(SUPPLIER_ORDER_STATUS_LABELS) as SupplierOrderStatus[];

const filterClass =
  "w-full rounded-md border border-foreground/20 bg-transparent px-2 py-1 text-xs font-normal outline-none focus:border-foreground/50";

/** Срок поставки, editable in place: saved on Enter or when the field is left. */
function DaysCell({ id, days }: { id: string; days: number | null }) {
  const initial = days === null ? "" : String(days);
  const [value, setValue] = useState(initial);
  const [synced, setSynced] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (initial !== synced) {
    setSynced(initial);
    setValue(initial);
  }

  function save() {
    const text = value.trim();
    if (text === synced) return;
    const next = text === "" ? null : Number(text);
    setError(null);
    startTransition(async () => {
      const result = await updateSupplierOrderDays(id, next);
      if (!result.ok) {
        setError(result.error);
        setValue(synced);
      }
    });
  }

  return (
    <>
      <span className="inline-flex items-center gap-1">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/D/g, ""))}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          disabled={pending}
          inputMode="numeric"
          placeholder="—"
          aria-label="Срок поставки, дней"
          className="w-14 rounded-md border border-foreground/20 bg-transparent px-2 py-1 text-right text-sm outline-none focus:border-foreground/50"
        />
        <span className="text-foreground/50">дн.</span>
      </span>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </>
  );
}

function StatusSelect({ id, status }: { id: string; status: SupplierOrderStatus }) {
  const [value, setValue] = useState(status);
  const [synced, setSynced] = useState(status);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (status !== synced) {
    setSynced(status);
    setValue(status);
  }

  function change(next: SupplierOrderStatus) {
    const prev = value;
    setValue(next);
    setError(null);
    startTransition(async () => {
      const result = await updateSupplierOrderStatus(id, next);
      if (!result.ok) {
        setValue(prev);
        setError(result.error);
      }
    });
  }

  return (
    <>
      <select
        value={value}
        disabled={pending}
        onChange={(e) => change(e.target.value as SupplierOrderStatus)}
        aria-label="Статус"
        className="rounded-md border border-foreground/20 bg-background px-2 py-1.5 text-xs outline-none focus:border-foreground/50"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {SUPPLIER_ORDER_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </>
  );
}

export function SupplierOrdersTable({ rows }: { rows: SupplierOrderRow[] }) {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [category, setCategory] = useState("");
  const categories = useMemo(
    () => [...new Set(rows.map((r) => r.category))].sort((a, b) => a.localeCompare(b, "ru")),
    [rows]
  );

  const filtered = useMemo(() => {
    const active = TEXT_COLUMNS.filter((c) => filters[c.key].trim());
    return rows.filter(
      (r) =>
        (!category || r.category === category) &&
        (!filters.status || r.status === filters.status) &&
        active.every((c) => c.get(r).toLowerCase().includes(filters[c.key].trim().toLowerCase()))
    );
  }, [rows, filters, category]);

  const hasActiveFilters = !!category || Object.values(filters).some(Boolean);

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold">Заказ поставщику</h1>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Категория"
          className="min-w-0 max-w-64 flex-1 rounded-md border border-foreground/20 bg-background px-2 py-1 text-sm outline-none focus:border-foreground/50"
        >
          <option value="">Все категории</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <SheetExportButton count={filtered.length} run={() => exportSupplierOrders(filtered.map((r) => r.id))} />
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setFilters(EMPTY);
              setCategory("");
            }}
            className="ml-auto text-sm text-foreground/50 hover:text-foreground"
          >
            Сбросить фильтры
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-foreground/40">
          Пока пусто. Сюда попадают позиции из «Проценки» (кнопка «Заказать») и заказы покупателей на товар не из
          наличия.
        </p>
      ) : (
        <CrmTableScroll className="mt-3">
          <table className="w-full text-sm">
            <thead className={STICKY_THEAD}>
              <tr className="text-left text-foreground/50">
                {TEXT_COLUMNS.map((c) => (
                  <th key={c.key} className="py-2 pr-4">
                    {c.label}
                  </th>
                ))}
                <th className="py-2 pr-4">Статус</th>
                <th className="py-2" />
              </tr>
              <tr className="text-left">
                {TEXT_COLUMNS.map((c) => (
                  <th key={c.key} className="pb-2 pr-4">
                    <input
                      value={filters[c.key]}
                      onChange={(e) => setFilters((prev) => ({ ...prev, [c.key]: e.target.value }))}
                      placeholder="Поиск..."
                      className={filterClass}
                    />
                  </th>
                ))}
                <th className="pb-2 pr-4">
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value as Filters["status"] }))}
                    aria-label="Фильтр по статусу"
                    className={`${filterClass} bg-background`}
                  >
                    <option value="">Все</option>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {SUPPLIER_ORDER_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={TEXT_COLUMNS.length + 2} className="py-4 text-foreground/40">
                    Ничего не найдено.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="border-b border-foreground/10">
                    <td className="whitespace-nowrap py-2 pr-4">
                      {r.orderNumber ? (
                        <Link
                          href={`/admin/crm/orders?orderNumber=${encodeURIComponent(r.orderNumber)}`}
                          className="underline underline-offset-4"
                        >
                          {r.orderNumber}
                        </Link>
                      ) : (
                        <span className="text-foreground/40">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-foreground/70">{r.brand ?? "—"}</td>
                    <td className="py-2 pr-4">
                      <Link
                        href={`/admin/crm/price-check?product=${r.productId}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap py-2 pr-4">{r.sku}</td>
                    <td className="py-2 pr-4">{r.quantity}</td>
                    <td className="py-2 pr-4">{r.supplier ?? <span className="text-foreground/40">не выбран</span>}</td>
                    <td className="whitespace-nowrap py-2 pr-4">
                      <DaysCell id={r.id} days={r.deliveryDays} />
                    </td>
                    <td className="py-2 pr-4">{r.quality ?? "—"}</td>
                    <td className="py-2 pr-4">
                      <StatusSelect id={r.id} status={r.status} />
                    </td>
                    <td className="py-2 text-right">
                      <SupplierOrderDeleteButton id={r.id} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CrmTableScroll>
      )}
    </>
  );
}
