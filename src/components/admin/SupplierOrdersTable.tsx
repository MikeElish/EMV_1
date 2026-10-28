"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { SupplierOrderStatus } from "@prisma/client";
import {
  exportSupplierOrders,
  sendSupplierOrdersNow,
  updateSupplierOrderDays,
  updateSupplierOrderStatus,
  uploadSupplierInvoice,
} from "@/actions/admin/supplier-orders";
import { SUPPLIER_ORDER_STATUS_LABELS } from "@/lib/validators/supplier-orders";
import { CrmTableScroll, STICKY_THEAD } from "@/components/admin/CrmTableFrame";
import { SheetExportButton } from "@/components/admin/SheetExportButton";
import { SupplierOrderDeleteButton } from "@/components/admin/SupplierOrderDeleteButton";
import { useRememberedState } from "@/components/admin/AdminPlaces";

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
  purchaseNumber: number | null;
  sentAt: string | null;
  deliveryDate: string | null;
  files: { kind: string; fileName: string; fileUrl: string }[];
};

const FILE_KINDS: Record<string, string> = { INVOICE: "Счёт", PAYMENT: "Платёжка", OTHER: "Файл" };
const UNFINISHED_KEY = "crm-supplier-orders-unfinished";
const GROUPED_KEY = "crm-supplier-orders-grouped";

/** A supplier's invoice that came another way, into this line's supplier order. */
function InvoiceUpload({ id }: { id: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <label className={`cursor-pointer text-xs text-blue-600 hover:underline dark:text-blue-400 ${pending ? "opacity-50" : ""}`}>
      {pending ? "..." : "+ счёт"}
      <input
        type="file"
        className="hidden"
        disabled={pending}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          const form = new FormData();
          form.set("lineId", id);
          form.set("file", file);
          setError(null);
          startTransition(async () => {
            const r = await uploadSupplierInvoice(form);
            if (!r.ok) setError(r.error);
          });
        }}
      />
      {error && <span className="block text-red-600">{error}</span>}
    </label>
  );
}

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
  const [filters, setFilters] = useRememberedState<Filters>("filters", EMPTY);
  const [category, setCategory] = useRememberedState("category", "");
  const categories = useMemo(
    () => [...new Set(rows.map((r) => r.category))].sort((a, b) => a.localeCompare(b, "ru")),
    [rows]
  );

  const [unfinished, setUnfinished] = useState(false);
  const [grouped, setGrouped] = useState(false);
  const [sendNote, setSendNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [sending, startSending] = useTransition();

  // Remembered per browser.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only preference, read after hydration
      if (localStorage.getItem(UNFINISHED_KEY) === "1") setUnfinished(true);
      if (localStorage.getItem(GROUPED_KEY) === "1") setGrouped(true);
    } catch {
      // storage unavailable
    }
  }, []);
  function remember(key: string, value: boolean, set: (v: boolean) => void) {
    set(value);
    try {
      localStorage.setItem(key, value ? "1" : "0");
    } catch {
      // storage unavailable
    }
  }

  const filtered = useMemo(() => {
    const active = TEXT_COLUMNS.filter((c) => filters[c.key].trim());
    const list = rows.filter(
      (r) =>
        (!unfinished || r.status !== "DELIVERED") &&
        (!category || r.category === category) &&
        (!filters.status || r.status === filters.status) &&
        active.every((c) => c.get(r).toLowerCase().includes(filters[c.key].trim().toLowerCase()))
    );
    // Grouped: the lines of one customer order together, newest orders first.
    return grouped ? [...list].sort((a, b) => (b.orderNumber ?? "").localeCompare(a.orderNumber ?? "")) : list;
  }, [rows, filters, category, unfinished, grouped]);

  const toSend = filtered.filter((r) => r.status === "TO_ORDER" && !r.sentAt);
  function send() {
    setSendNote(null);
    startSending(async () => {
      const r = await sendSupplierOrdersNow(toSend.map((x) => x.id));
      setSendNote(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
    });
  }

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
        <button
          type="button"
          onClick={send}
          disabled={sending || !toSend.length}
          title="Письмо с Excel каждому поставщику (по заказам клиентов) — на e-mail из карточки компании; так же уходят сами каждые полчаса"
          className="rounded-md bg-foreground px-3 py-1 text-sm font-medium text-background disabled:opacity-40"
        >
          {sending ? "Отправляем..." : `Отправить поставщикам (${toSend.length})`}
        </button>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground/70">
          <input type="checkbox" checked={unfinished} onChange={(e) => remember(UNFINISHED_KEY, e.target.checked, setUnfinished)} />
          Не завершённые
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground/70">
          <input type="checkbox" checked={grouped} onChange={(e) => remember(GROUPED_KEY, e.target.checked, setGrouped)} />
          Группировать по заказам
        </label>
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

      {sendNote && <p className={`mt-2 text-sm ${sendNote.ok ? "text-green-600" : "text-red-600"}`}>{sendNote.text}</p>}
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
                <th className="py-2 pr-4">Дата поставки</th>
                <th className="py-2 pr-4">Статус</th>
                <th className="py-2 pr-4">Файлы</th>
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
                <th className="pb-2 pr-4" />
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
                <th className="pb-2 pr-4" />
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={TEXT_COLUMNS.length + 4} className="py-4 text-foreground/40">
                    Ничего не найдено.
                  </td>
                </tr>
              ) : (
                filtered.map((r, i) => (
                  <tr
                    key={r.id}
                    className={`border-b border-foreground/10 ${
                      grouped && i > 0 && filtered[i - 1].orderNumber !== r.orderNumber ? "border-t-2 border-t-foreground/30" : ""
                    }`}
                  >
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
                    <td className="whitespace-nowrap py-2 pr-4" title={r.sentAt ? `Заказ № ${r.purchaseNumber} отправлен ${new Date(r.sentAt).toLocaleDateString("ru-RU")}` : "Ещё не отправлен: от сегодняшнего дня"}>
                      {r.deliveryDate ? new Date(r.deliveryDate).toLocaleDateString("ru-RU") : "—"}
                      {r.sentAt && <div className="text-xs text-foreground/50">№ {r.purchaseNumber}</div>}
                    </td>
                    <td className="py-2 pr-4">
                      <StatusSelect id={r.id} status={r.status} />
                    </td>
                    <td className="py-2 pr-4">
                      {r.files.map((f) => (
                        <a key={f.fileUrl} href={f.fileUrl} download={f.fileName} className="block max-w-40 truncate text-xs text-blue-600 hover:underline dark:text-blue-400">
                          {FILE_KINDS[f.kind] ?? "Файл"}: {f.fileName}
                        </a>
                      ))}
                      {r.supplier && ["TO_ORDER", "AWAITING_PAYMENT"].includes(r.status) && <InvoiceUpload id={r.id} />}
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
