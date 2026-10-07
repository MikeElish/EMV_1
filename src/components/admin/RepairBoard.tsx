"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { RepairLineKind, RepairShop, RepairStatus, RepairType } from "@prisma/client";
import {
  deleteRepair,
  deleteRepairLine,
  saveRepair,
  saveRepairLine,
  searchRepairCatalog,
  setRepairStatus,
  type RepairCatalogItem,
} from "@/actions/admin/repairs";
import {
  REPAIR_LINE_KIND_LABELS,
  REPAIR_SHOP_LABELS,
  REPAIR_STATUS_LABELS,
  REPAIR_TYPE_LABELS,
} from "@/lib/validators/repairs";
import { formatRubPrecise } from "@/lib/money";
import { useEscape } from "@/lib/use-escape";
import { CrmTableScroll, STICKY_THEAD } from "@/components/admin/CrmTableFrame";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { RepairDocumentsModal } from "@/components/admin/RepairDocumentsModal";
import { Modal } from "@/components/Modal";

export type RepairLineRow = {
  id: string;
  kind: RepairLineKind;
  productId: string | null;
  serviceId: string | null;
  name: string;
  quantity: number;
  /** Kopecks per unit. */
  price: number;
};
export type RepairRow = {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  vehicleId: string;
  vehicleName: string;
  plate: string;
  type: RepairType;
  shop: RepairShop;
  status: RepairStatus;
  note: string | null;
  lines: RepairLineRow[];
  files: number;
};
export type VehicleOption = { id: string; name: string; plate: string };

const keysOf = <T extends string>(labels: Record<T, string>) => Object.keys(labels) as T[];
const TYPES = keysOf(REPAIR_TYPE_LABELS);
const SHOPS = keysOf(REPAIR_SHOP_LABELS);
const STATUSES = keysOf(REPAIR_STATUS_LABELS);
const KINDS = keysOf(REPAIR_LINE_KIND_LABELS);

const dayLabel = (iso: string) => iso.split("-").reverse().join(".");
const qty = (n: number) => n.toLocaleString("ru-RU", { maximumFractionDigits: 3 });
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Moscow" });

const inputClass =
  "mt-1 w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm outline-none focus:border-foreground/50";
const filterClass =
  "w-full rounded-md border border-foreground/20 bg-transparent px-2 py-1 text-xs font-normal outline-none focus:border-foreground/50";
const selectClass =
  "rounded-md border border-foreground/20 bg-background px-2 py-1.5 text-xs outline-none focus:border-foreground/50";
const STATUS_COLOR: Record<RepairStatus, string> = {
  PLANNED: "text-sky-600 dark:text-sky-400",
  IN_REPAIR: "text-amber-600 dark:text-amber-400",
  AWAITING_PARTS: "text-violet-600 dark:text-violet-400",
  DONE: "text-green-600 dark:text-green-500",
  CANCELLED: "text-foreground/40",
};

// ---- Repair card window ------------------------------------------------------------

function RepairModal({
  repair,
  vehicles,
  onClose,
  onSaved,
  onDeleted,
}: {
  repair: RepairRow | null;
  vehicles: VehicleOption[];
  onClose: () => void;
  onSaved: (id: string) => void;
  onDeleted: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (k: string) => String(form.get(k) ?? "");
    setError(null);
    startTransition(async () => {
      const result = await saveRepair(repair?.id ?? null, {
        date: value("date"),
        vehicleId: value("vehicleId"),
        type: value("type") as RepairType,
        shop: value("shop") as RepairShop,
        status: value("status") as RepairStatus,
        note: value("note"),
      });
      if (!result.ok) setError(result.error);
      else onSaved(result.id);
    });
  }

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-lg">
      <h2 className="text-lg font-semibold">{repair ? "Карточка ремонта" : "Новый ремонт"}</h2>
      <form onSubmit={submit} className="mt-4 space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            Дата
            <input name="date" type="date" required defaultValue={repair?.date ?? today()} className={inputClass} />
          </label>
          <label className="block">
            Статус
            <select name="status" defaultValue={repair?.status ?? "PLANNED"} className={inputClass}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {REPAIR_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          Техника
          <select name="vehicleId" required defaultValue={repair?.vehicleId ?? ""} className={inputClass}>
            <option value="" disabled>
              Выберите технику
            </option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} · {v.plate}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            Вид ремонта
            <select name="type" required defaultValue={repair?.type ?? ""} className={inputClass}>
              <option value="" disabled>
                Выберите
              </option>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {REPAIR_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            Цех
            <select name="shop" required defaultValue={repair?.shop ?? ""} className={inputClass}>
              <option value="" disabled>
                Выберите
              </option>
              {SHOPS.map((s) => (
                <option key={s} value={s}>
                  {REPAIR_SHOP_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          Комментарий
          <textarea name="note" rows={2} defaultValue={repair?.note ?? ""} className={inputClass} />
        </label>
        {vehicles.length === 0 && (
          <p className="text-foreground/50">Сначала добавьте технику во вкладке «Техника».</p>
        )}
        {error && <p className="text-red-600">{error}</p>}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-foreground px-5 py-2 font-medium text-background hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Сохраняем..." : "Сохранить"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-foreground/20 px-5 py-2 font-medium hover:bg-foreground/5"
          >
            Отмена
          </button>
          {repair && (
            <DeleteButton
              action={async () => {
                const result = await deleteRepair(repair.id);
                if (result.ok) onDeleted();
                return result;
              }}
              confirmText="Удалить карточку ремонта со всеми работами, материалами и файлами?"
              className="ml-auto text-red-600 hover:underline disabled:opacity-50"
            />
          )}
        </div>
      </form>
    </Modal>
  );
}

// ---- Work / material window ----------------------------------------------------------

function LineModal({
  repairId,
  line,
  onClose,
  onSaved,
}: {
  repairId: string;
  line: RepairLineRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<RepairLineKind>(line?.kind ?? "SERVICE");
  const [name, setName] = useState(line?.name ?? "");
  const [catalogId, setCatalogId] = useState<string | null>(line?.productId ?? line?.serviceId ?? null);
  const [quantity, setQuantity] = useState(line ? String(line.quantity) : "1");
  const [price, setPrice] = useState(line ? String(line.price / 100) : "");
  const [found, setFound] = useState<RepairCatalogItem[]>([]);
  const [listOpen, setListOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  useEscape(() => setListOpen(false), listOpen);

  // The catalogue as you type (Услуги -- all of them when the field is empty).
  useEffect(() => {
    if (!listOpen) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchRepairCatalog(kind, name).then((items) => {
        if (!cancelled) setFound(items);
      });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [kind, name, listOpen]);

  const num = (v: string) => Number(v.replace(/\s/g, "").replace(",", "."));
  const cost = num(quantity) * num(price);

  function pick(item: RepairCatalogItem) {
    setName(item.name);
    setCatalogId(item.id);
    setPrice(String(item.price / 100));
    setListOpen(false);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await saveRepairLine(repairId, line?.id ?? null, {
        kind,
        ...(kind === "PRODUCT" ? { productId: catalogId ?? undefined } : { serviceId: catalogId ?? undefined }),
        name,
        quantity: num(quantity),
        price: num(price),
      });
      if (!result.ok) setError(result.error);
      else onSaved();
    });
  }

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-lg">
      <h2 className="text-lg font-semibold">{line ? "Позиция ремонта" : "Новая позиция"}</h2>
      <form onSubmit={submit} className="mt-4 space-y-3 text-sm">
        <div className="flex gap-2" role="radiogroup" aria-label="Вид позиции">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => {
                if (k === kind) return;
                setKind(k);
                setCatalogId(null);
                setFound([]);
              }}
              className={`rounded-md border px-4 py-1.5 font-medium transition-colors ${
                kind === k ? "border-foreground bg-foreground text-background" : "border-foreground/20 hover:bg-foreground/5"
              }`}
            >
              {k === "SERVICE" ? "Работа (услуга)" : "Материал (товар)"}
            </button>
          ))}
        </div>
        <label className="relative block">
          Наименование
          <input
            id="repair-line-name"
            value={name}
            required
            autoComplete="off"
            onChange={(e) => {
              setName(e.target.value);
              setCatalogId(null);
              setListOpen(true);
            }}
            onFocus={() => setListOpen(true)}
            onBlur={() => setTimeout(() => setListOpen(false), 150)}
            placeholder={kind === "SERVICE" ? "Из «Услуг» или своё название" : "Наименование или артикул товара"}
            className={inputClass}
          />
          {listOpen && found.length > 0 && (
            <ul
              role="listbox"
              aria-label="Каталог"
              className="absolute inset-x-0 top-full z-10 mt-1 max-h-60 overflow-auto rounded-md border border-foreground/15 bg-background py-1 shadow-lg"
            >
              {found.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(item)}
                    className="flex w-full items-baseline gap-2 px-3 py-1.5 text-left hover:bg-foreground/5"
                  >
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                    {item.sku && <span className="shrink-0 text-xs text-foreground/40">{item.sku}</span>}
                    <span className="shrink-0 text-xs text-foreground/60">{formatRubPrecise(item.price)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <span className="mt-1 block text-xs text-foreground/40">
            {catalogId
              ? `Из каталога «${kind === "SERVICE" ? "Услуги" : "Товары"}»`
              : "Выберите из каталога или впишите своё наименование"}
          </span>
        </label>
        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            Количество
            <input id="repair-line-qty" value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="decimal" required className={inputClass} />
          </label>
          <label className="block">
            Цена, ₽
            <input id="repair-line-price" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" required className={inputClass} />
          </label>
          <div>
            Стоимость
            <p className="mt-1 py-2 font-medium">{Number.isFinite(cost) ? formatRubPrecise(Math.round(cost * 100)) : "—"}</p>
          </div>
        </div>
        {error && <p className="text-red-600">{error}</p>}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-foreground px-5 py-2 font-medium text-background hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Сохраняем..." : "Сохранить"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-foreground/20 px-5 py-2 font-medium hover:bg-foreground/5"
          >
            Отмена
          </button>
          {line && (
            <DeleteButton
              action={async () => {
                const result = await deleteRepairLine(line.id);
                if (result.ok) onSaved();
                return result;
              }}
              confirmText={`Удалить «${line.name}»?`}
              className="ml-auto text-red-600 hover:underline disabled:opacity-50"
            />
          )}
        </div>
      </form>
    </Modal>
  );
}

// ---- Status in the list --------------------------------------------------------------

function StatusSelect({ id, status }: { id: string; status: RepairStatus }) {
  const [value, setValue] = useState(status);
  const [synced, setSynced] = useState(status);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (status !== synced) {
    setSynced(status);
    setValue(status);
  }

  function change(next: RepairStatus) {
    const prev = value;
    setValue(next);
    setError(null);
    startTransition(async () => {
      const result = await setRepairStatus(id, next);
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
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => change(e.target.value as RepairStatus)}
        aria-label="Статус"
        className={`${selectClass} font-medium ${STATUS_COLOR[value]}`}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s} className="text-foreground">
            {REPAIR_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </>
  );
}

// ---- Board ------------------------------------------------------------------------------

type Filters = { date: string; vehicle: string; plate: string; type: RepairType | ""; shop: RepairShop | ""; status: RepairStatus | "" };
const EMPTY: Filters = { date: "", vehicle: "", plate: "", type: "", shop: "", status: "" };

export function RepairBoard({ repairs, vehicles }: { repairs: RepairRow[]; vehicles: VehicleOption[] }) {
  const router = useRouter();
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<RepairRow | "new" | null>(null);
  const [line, setLine] = useState<RepairLineRow | "new" | null>(null);
  const [filesOpen, setFilesOpen] = useState(false);

  const filtered = useMemo(() => {
    const has = (v: string, q: string) => v.toLowerCase().includes(q.trim().toLowerCase());
    return repairs.filter(
      (r) =>
        (!filters.date || has(dayLabel(r.date), filters.date)) &&
        (!filters.vehicle || has(r.vehicleName, filters.vehicle)) &&
        (!filters.plate || has(r.plate, filters.plate)) &&
        (!filters.type || r.type === filters.type) &&
        (!filters.shop || r.shop === filters.shop) &&
        (!filters.status || r.status === filters.status)
    );
  }, [repairs, filters]);

  const selected = repairs.find((r) => r.id === selectedId) ?? null;
  const total = selected?.lines.reduce((sum, l) => sum + Math.round(l.quantity * l.price), 0) ?? 0;
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="flex min-h-0 flex-1 gap-6">
      {/* The register of repair cards: half of the screen */}
      <section className="flex min-h-0 w-1/2 min-w-0 flex-col">
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setEditing("new")}
            aria-label="Добавить ремонт"
            className="flex h-8 w-8 items-center justify-center rounded-md bg-green-600 text-lg font-bold leading-none text-white transition-opacity hover:opacity-90"
          >
            +
          </button>
          <h1 className="text-lg font-semibold">Ремонты</h1>
          {Object.values(filters).some(Boolean) && (
            <button
              type="button"
              onClick={() => setFilters(EMPTY)}
              className="ml-auto text-sm text-foreground/50 hover:text-foreground"
            >
              Сбросить фильтры
            </button>
          )}
        </div>
        <CrmTableScroll className="mt-3">
          <table className="w-full text-sm">
            <thead className={STICKY_THEAD}>
              <tr className="text-left text-foreground/50">
                <th className="py-2 pr-3">Дата</th>
                <th className="py-2 pr-3">Наименование техники</th>
                <th className="py-2 pr-3">Гос.номер</th>
                <th className="py-2 pr-3">Вид ремонта</th>
                <th className="py-2 pr-3">Цех</th>
                <th className="py-2 pr-3">Статус</th>
              </tr>
              <tr className="text-left">
                {(["date", "vehicle", "plate"] as const).map((k) => (
                  <th key={k} className="pb-2 pr-3">
                    <input value={filters[k]} onChange={(e) => set(k, e.target.value)} placeholder="Поиск..." className={filterClass} />
                  </th>
                ))}
                <th className="pb-2 pr-3">
                  <select value={filters.type} onChange={(e) => set("type", e.target.value as Filters["type"])} aria-label="Фильтр: вид ремонта" className={`${filterClass} bg-background`}>
                    <option value="">Все</option>
                    {TYPES.map((t) => (
                      <option key={t} value={t}>
                        {REPAIR_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </th>
                <th className="pb-2 pr-3">
                  <select value={filters.shop} onChange={(e) => set("shop", e.target.value as Filters["shop"])} aria-label="Фильтр: цех" className={`${filterClass} bg-background`}>
                    <option value="">Все</option>
                    {SHOPS.map((s) => (
                      <option key={s} value={s}>
                        {REPAIR_SHOP_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </th>
                <th className="pb-2 pr-3">
                  <select value={filters.status} onChange={(e) => set("status", e.target.value as Filters["status"])} aria-label="Фильтр: статус" className={`${filterClass} bg-background`}>
                    <option value="">Все</option>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {REPAIR_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 text-foreground/40">
                    {repairs.length ? "Ничего не найдено." : "Ремонтов пока нет — добавьте кнопкой «+»."}
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    aria-selected={r.id === selectedId}
                    className={`cursor-pointer border-b border-foreground/10 transition-colors ${
                      r.id === selectedId ? "bg-foreground/10" : "hover:bg-foreground/5"
                    }`}
                  >
                    <td className="whitespace-nowrap py-2 pr-3">{dayLabel(r.date)}</td>
                    <td className="py-2 pr-3">{r.vehicleName}</td>
                    <td className="whitespace-nowrap py-2 pr-3">{r.plate}</td>
                    <td className="py-2 pr-3">{REPAIR_TYPE_LABELS[r.type]}</td>
                    <td className="py-2 pr-3">{REPAIR_SHOP_LABELS[r.shop]}</td>
                    <td className="py-2 pr-3">
                      <StatusSelect id={r.id} status={r.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CrmTableScroll>
      </section>

      {/* The chosen card: works and materials */}
      <section className="flex min-h-0 w-1/2 min-w-0 flex-col">
        {!selected ? (
          <>
            <h2 className="shrink-0 text-lg font-semibold">Карточка ремонта</h2>
            <p className="mt-6 text-sm text-foreground/40">Выберите ремонт слева — здесь появятся работы и материалы.</p>
          </>
        ) : (
          <>
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setLine("new")}
                aria-label="Добавить позицию"
                title="Добавить работу или материал"
                className="flex h-8 w-8 items-center justify-center rounded-md bg-green-600 text-lg font-bold leading-none text-white transition-opacity hover:opacity-90"
              >
                +
              </button>
              <h2 className="min-w-0 truncate text-lg font-semibold">
                {selected.vehicleName} <span className="font-normal text-foreground/50">· {selected.plate}</span>
              </h2>
              <button
                type="button"
                onClick={() => setEditing(selected)}
                className="ml-auto shrink-0 rounded-md border border-foreground/20 px-3 py-1 text-sm font-medium hover:bg-foreground/5"
              >
                Изменить
              </button>
            </div>
            <p className="mt-1 shrink-0 text-sm text-foreground/60">
              {dayLabel(selected.date)} · {REPAIR_TYPE_LABELS[selected.type]} · цех: {REPAIR_SHOP_LABELS[selected.shop]} ·{" "}
              <span className={STATUS_COLOR[selected.status]}>{REPAIR_STATUS_LABELS[selected.status]}</span>
              {selected.note && <span className="block text-foreground/50">{selected.note}</span>}
            </p>

            <CrmTableScroll className="mt-3 flex-initial!">
              <table className="w-full text-sm">
                <thead className={STICKY_THEAD}>
                  <tr className="text-left text-foreground/50">
                    <th className="py-2 pr-4">Наименование</th>
                    <th className="py-2 pr-4 text-right">Количество</th>
                    <th className="py-2 pr-4 text-right">Цена</th>
                    <th className="py-2 text-right">Стоимость</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.lines.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-4 text-foreground/40">
                        Работ и материалов пока нет — добавьте кнопкой «+».
                      </td>
                    </tr>
                  ) : (
                    selected.lines.map((l) => (
                      <tr
                        key={l.id}
                        onClick={() => setLine(l)}
                        className="cursor-pointer border-b border-foreground/10 hover:bg-foreground/5"
                      >
                        <td className="py-2 pr-4">
                          {l.name}
                          <span className="ml-2 text-xs text-foreground/40">{REPAIR_LINE_KIND_LABELS[l.kind]}</span>
                        </td>
                        <td className="whitespace-nowrap py-2 pr-4 text-right">{qty(l.quantity)}</td>
                        <td className="whitespace-nowrap py-2 pr-4 text-right">{formatRubPrecise(l.price)}</td>
                        <td className="whitespace-nowrap py-2 text-right">{formatRubPrecise(Math.round(l.quantity * l.price))}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {selected.lines.length > 0 && (
                  <tfoot>
                    <tr className="font-semibold">
                      <td colSpan={3} className="py-2 pr-4 text-right">
                        Итого
                      </td>
                      <td className="whitespace-nowrap py-2 text-right">{formatRubPrecise(total)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </CrmTableScroll>

            <div className="mt-4 shrink-0">
              <button
                type="button"
                onClick={() => setFilesOpen(true)}
                className="rounded-md border border-foreground/20 px-4 py-1.5 text-sm font-medium hover:bg-foreground/5"
              >
                Файлы{selected.files ? ` (${selected.files})` : ""}
              </button>
            </div>
          </>
        )}
      </section>

      {editing && (
        <RepairModal
          repair={editing === "new" ? null : editing}
          vehicles={vehicles}
          onClose={() => setEditing(null)}
          onSaved={(id) => {
            setEditing(null);
            setSelectedId(id);
            router.refresh();
          }}
          onDeleted={() => {
            setEditing(null);
            setSelectedId(null);
            router.refresh();
          }}
        />
      )}
      {line && selected && (
        <LineModal
          repairId={selected.id}
          line={line === "new" ? null : line}
          onClose={() => setLine(null)}
          onSaved={() => {
            setLine(null);
            router.refresh();
          }}
        />
      )}
      {filesOpen && selected && (
        <RepairDocumentsModal
          repairId={selected.id}
          title={`${selected.vehicleName} · ${dayLabel(selected.date)}`}
          onClose={() => setFilesOpen(false)}
          onChanged={() => router.refresh()}
        />
      )}
    </div>
  );
}
