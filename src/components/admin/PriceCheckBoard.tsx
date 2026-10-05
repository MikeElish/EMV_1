"use client";

import { useCallback, useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { formatRubPrecise } from "@/lib/money";
import {
  analyzeOfferImport,
  commitOfferImport,
  deleteOffer,
  listProductOffers,
  orderFromOffer,
  saveOffer,
  type OfferImportAnalysis,
  type OfferView,
} from "@/actions/admin/price-check";
import { CrmTableScroll, STICKY_THEAD } from "@/components/admin/CrmTableFrame";
import { QUALITY_SUGGESTIONS } from "@/components/admin/ProductPricesPanel";
import { Modal } from "@/components/Modal";
import { exportPriceCheck } from "@/actions/admin/supplier-orders";
import { SheetExportButton } from "@/components/admin/SheetExportButton";

export type PriceCheckProduct = {
  id: string;
  brand: string | null;
  name: string;
  sku: string;
  category: string;
  /** Latest «Дата обновления» of its offers. */
  updatedAt: Date | null;
  /** Customer order lines waiting in «Проверка заказа». */
  checking: number;
};
export type SupplierOption = { id: string; name: string; inn: string | null };

const day = (d: Date | null) => (d ? new Date(d).toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" }) : "—");
const days = (n: number | null) => (n === null ? "—" : `${n} дн.`);
const inputClass =
  "mt-1 w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm outline-none focus:border-foreground/50";
const filterClass =
  "w-full rounded-md border border-foreground/20 bg-transparent px-2 py-1 text-xs font-normal outline-none focus:border-foreground/50";

type ProductFilters = { brand: string; name: string; sku: string; updated: string };
const EMPTY: ProductFilters = { brand: "", name: "", sku: "", updated: "" };
const COLUMNS: { key: keyof ProductFilters; label: string; get: (p: PriceCheckProduct) => string }[] = [
  { key: "brand", label: "Бренд", get: (p) => p.brand ?? "" },
  { key: "name", label: "Наименование", get: (p) => p.name },
  { key: "sku", label: "Артикул", get: (p) => p.sku },
  { key: "updated", label: "Дата обновления", get: (p) => day(p.updatedAt) },
];

// ---- Offer window -------------------------------------------------------------

function OfferModal({
  productId,
  offer,
  suppliers,
  onClose,
  onSaved,
}: {
  productId: string;
  offer: OfferView | null;
  suppliers: SupplierOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [removeFile, setRemoveFile] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    form.set("productId", productId);
    if (offer) form.set("id", offer.id);
    if (removeFile) form.set("removeFile", "1");
    setError(null);
    startTransition(async () => {
      const result = await saveOffer(form);
      if (!result.ok) setError(result.error);
      else onSaved();
    });
  }

  function remove() {
    if (!offer || !confirm("Удалить это предложение?")) return;
    startTransition(async () => {
      const result = await deleteOffer(offer.id);
      if (!result.ok) setError(result.error);
      else onSaved();
    });
  }

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-lg">
      <h2 className="text-lg font-semibold">{offer ? "Предложение поставщика" : "Новое предложение"}</h2>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <div>
          <label htmlFor="offer-supplier" className="text-sm text-foreground/60">
            Поставщик *
          </label>
          <select id="offer-supplier" name="supplierId" required defaultValue={offer?.supplierId ?? ""} className={inputClass}>
            <option value="">— выберите —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.inn ? ` (ИНН ${s.inn})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="offer-price" className="text-sm text-foreground/60">
              Цена, ₽ *
            </label>
            <input
              id="offer-price"
              name="price"
              required
              inputMode="decimal"
              defaultValue={offer ? String(offer.price / 100).replace(".", ",") : ""}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="offer-days" className="text-sm text-foreground/60">
              Срок, дн.
            </label>
            <input
              id="offer-days"
              name="deliveryDays"
              inputMode="numeric"
              defaultValue={offer?.deliveryDays ?? ""}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="offer-quality" className="text-sm text-foreground/60">
              Качество
            </label>
            <input
              id="offer-quality"
              name="quality"
              list="offer-quality-list"
              defaultValue={offer?.quality ?? ""}
              className={inputClass}
            />
            <datalist id="offer-quality-list">
              {QUALITY_SUGGESTIONS.map((q) => (
                <option key={q} value={q} />
              ))}
            </datalist>
          </div>
        </div>
        <div>
          <label htmlFor="offer-file" className="text-sm text-foreground/60">
            Файл (КП, счёт, прайс)
          </label>
          {offer?.fileUrl && !removeFile && (
            <p className="mt-1 text-sm">
              <a href={offer.fileUrl} target="_blank" rel="noopener" className="underline underline-offset-4">
                {offer.fileName}
              </a>
              <button type="button" onClick={() => setRemoveFile(true)} className="ml-3 text-xs text-red-600 hover:underline">
                убрать
              </button>
            </p>
          )}
          <input
            id="offer-file"
            name="file"
            type="file"
            className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border file:border-foreground/20 file:bg-transparent file:px-3 file:py-1.5 file:text-sm file:text-foreground"
          />
        </div>
        {offer && (
          <p className="text-xs text-foreground/50">
            Дата обновления: {day(offer.priceUpdatedAt)} — меняется при изменении цены или срока.
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-foreground px-5 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Сохраняем..." : "Сохранить"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-foreground/20 px-5 py-2 text-sm font-medium hover:bg-foreground/5"
          >
            Отмена
          </button>
          {offer && (
            <button type="button" onClick={remove} disabled={pending} className="ml-auto text-sm text-red-600 hover:underline">
              Удалить предложение
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

function OrderModal({ offer, onClose }: { offer: OfferView; onClose: () => void }) {
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await orderFromOffer(offer.id, Number(quantity));
      if (!result.ok) setError(result.error);
      else setDone(true);
    });
  }

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-sm">
      <h2 className="text-lg font-semibold">Заказать у поставщика</h2>
      <p className="mt-1 text-sm text-foreground/60">
        {offer.supplierName ?? "—"} · {formatRubPrecise(offer.price)} · {days(offer.deliveryDays)}
      </p>
      {done ? (
        <>
          <p className="mt-4 text-sm">Позиция добавлена во вкладку «Заказ поставщику».</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 rounded-md bg-foreground px-5 py-2 text-sm font-medium text-background hover:opacity-90"
          >
            Готово
          </button>
        </>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="order-qty" className="text-sm text-foreground/60">
              Количество
            </label>
            <input
              id="order-qty"
              inputMode="numeric"
              autoFocus
              value={quantity}
              onChange={(e) => setQuantity(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className={inputClass}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-green-600 px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Заказать
          </button>
        </form>
      )}
    </Modal>
  );
}

// ---- Excel upload ---------------------------------------------------------------

const KIND_LABELS = { update: "обновить", add: "новое предложение", missing: "нет такого артикула" } as const;

function ImportModal({ suppliers, onClose, onDone }: { suppliers: SupplierOption[]; onClose: () => void; onDone: () => void }) {
  const [supplierId, setSupplierId] = useState("");
  const [analysis, setAnalysis] = useState<Extract<OfferImportAnalysis, { ok: true }> | null>(null);
  const [createMissing, setCreateMissing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const r = await analyzeOfferImport(form);
      if (!r.ok) setError(r.error);
      else setAnalysis(r);
    });
  }

  function commit() {
    if (!analysis) return;
    startTransition(async () => {
      const r = await commitOfferImport({ supplierId, rows: analysis.rows, createMissing });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setResult(
        `Обновлено предложений: ${r.updated}, добавлено: ${r.added}, новых карточек: ${r.created}, пропущено: ${r.skipped}.`
      );
      onDone();
    });
  }

  const count = (kind: keyof typeof KIND_LABELS) => analysis?.rows.filter((r) => r.kind === kind).length ?? 0;

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-4xl">
      <h2 className="text-lg font-semibold">Загрузка предложений из Excel</h2>
      {result ? (
        <>
          <p className="mt-4 text-sm">{result}</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 rounded-md bg-foreground px-5 py-2 text-sm font-medium text-background hover:opacity-90"
          >
            Готово
          </button>
        </>
      ) : !analysis ? (
        <form onSubmit={analyze} className="mt-4 space-y-4">
          <p className="text-sm text-foreground/60">
            Столбцы по порядку: <b>Бренд, Наименование, Артикул, Цена, Итого, Срок поставки</b>. Первая строка — заголовки.
            Если «Цена» пустая, берётся «Итого». Срок — в днях («3», «2-3 дня»). Позиции сопоставляются с номенклатурой по
            артикулу (и бренду, если артикул встречается у нескольких брендов).
          </p>
          <div>
            <label htmlFor="import-supplier" className="text-sm text-foreground/60">
              Поставщик *
            </label>
            <select
              id="import-supplier"
              name="supplierId"
              required
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className={inputClass}
            >
              <option value="">— выберите —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <input
            name="file"
            type="file"
            required
            accept=".xlsx,.xls,.ods,.csv"
            className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-foreground/20 file:bg-transparent file:px-3 file:py-1.5 file:text-sm file:text-foreground"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-foreground px-5 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Читаем файл..." : "Проверить файл"}
          </button>
        </form>
      ) : (
        <div className="mt-4 space-y-4 text-sm">
          <p>
            Обновить: <b>{count("update")}</b> · новых предложений: <b>{count("add")}</b> · нет в номенклатуре:{" "}
            <b>{count("missing")}</b>
            {analysis.errors.length > 0 && (
              <>
                {" "}
                · ошибок: <b className="text-red-600">{analysis.errors.length}</b>
              </>
            )}
          </p>
          {analysis.duplicates.length > 0 && (
            <p className="text-yellow-700 dark:text-yellow-400">
              Артикулы встречаются в файле несколько раз (взята последняя строка): {analysis.duplicates.join(", ")}
            </p>
          )}
          {analysis.errors.length > 0 && (
            <ul className="max-h-24 overflow-y-auto text-red-600">
              {analysis.errors.map((e) => (
                <li key={e.row}>
                  Строка {e.row}: {e.message}
                </li>
              ))}
            </ul>
          )}
          <div className="max-h-[45vh] overflow-auto rounded-md border border-foreground/10">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="text-left text-foreground/50">
                  <th className="px-2 py-1.5">Стр.</th>
                  <th className="px-2 py-1.5">Артикул</th>
                  <th className="px-2 py-1.5">Наименование</th>
                  <th className="px-2 py-1.5">Цена</th>
                  <th className="px-2 py-1.5">Срок</th>
                  <th className="px-2 py-1.5">Что будет</th>
                </tr>
              </thead>
              <tbody>
                {analysis.rows.map((r) => (
                  <tr key={r.row} className="border-t border-foreground/10">
                    <td className="px-2 py-1 text-foreground/50">{r.row}</td>
                    <td className="px-2 py-1">
                      {r.sku}
                      {r.brand && <span className="text-foreground/50"> · {r.brand}</span>}
                    </td>
                    <td className="px-2 py-1">{r.productName ?? r.name}</td>
                    <td className="whitespace-nowrap px-2 py-1">
                      {r.oldPrice !== null && r.oldPrice !== r.price && (
                        <span className="text-foreground/40 line-through">{formatRubPrecise(r.oldPrice)} </span>
                      )}
                      {formatRubPrecise(r.price)}
                    </td>
                    <td className="px-2 py-1">{days(r.deliveryDays)}</td>
                    <td className={`px-2 py-1 ${r.kind === "missing" ? "text-yellow-700 dark:text-yellow-400" : ""}`}>
                      {KIND_LABELS[r.kind]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {count("missing") > 0 && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={createMissing} onChange={(e) => setCreateMissing(e.target.checked)} />
              Создать карточки для отсутствующих артикулов (неактивные, категория «Из проценки — не распределено»)
            </label>
          )}
          {error && <p className="text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={commit}
              disabled={pending || analysis.rows.length === 0}
              className="rounded-md bg-green-600 px-5 py-2 font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Загружаем..." : "Загрузить"}
            </button>
            <button
              type="button"
              onClick={() => setAnalysis(null)}
              className="rounded-md border border-foreground/20 px-5 py-2 font-medium hover:bg-foreground/5"
            >
              Другой файл
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ---- Board ------------------------------------------------------------------------

export function PriceCheckBoard({
  products,
  suppliers,
  initialProductId,
}: {
  products: PriceCheckProduct[];
  suppliers: SupplierOption[];
  initialProductId?: string;
}) {
  const router = useRouter();
  const [filters, setFilters] = useState<ProductFilters>(EMPTY);
  const [onlyChecking, setOnlyChecking] = useState(false);
  const [category, setCategory] = useState("");
  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category))].sort((a, b) => a.localeCompare(b, "ru")),
    [products]
  );
  const [selectedId, setSelectedId] = useState<string | null>(initialProductId ?? null);
  const [offers, setOffers] = useState<OfferView[] | null>(null);
  const [editing, setEditing] = useState<OfferView | "new" | null>(null);
  const [ordering, setOrdering] = useState<OfferView | null>(null);
  const [importing, setImporting] = useState(false);

  const filtered = useMemo(() => {
    const active = COLUMNS.filter((c) => filters[c.key].trim());
    const list = products.filter(
      (p) =>
        (!onlyChecking || p.checking > 0) &&
        (!category || p.category === category) &&
        active.every((c) => c.get(p).toLowerCase().includes(filters[c.key].trim().toLowerCase()))
    );
    // What is on check: by brand, then by name.
    if (onlyChecking) {
      list.sort(
        (a, b) => (a.brand ?? "").localeCompare(b.brand ?? "", "ru") || a.name.localeCompare(b.name, "ru")
      );
    }
    return list;
  }, [products, filters, onlyChecking, category]);

  const selected = products.find((p) => p.id === selectedId) ?? null;

  const loadOffers = useCallback(async (productId: string) => {
    setOffers(null);
    setOffers(await listProductOffers(productId));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    listProductOffers(selectedId).then((list) => {
      if (!cancelled) setOffers(list);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  function choose(id: string) {
    if (id === selectedId) return;
    setOffers(null);
    setSelectedId(id);
  }

  function afterChange() {
    setEditing(null);
    if (selectedId) loadOffers(selectedId);
    router.refresh();
  }

  return (
    <div className="flex min-h-0 flex-1 gap-6">
      {/* Nomenclature: half of the screen */}
      <section className="flex min-h-0 w-1/2 min-w-0 flex-col">
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <h1 className="text-lg font-semibold">Номенклатура</h1>
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
          <SheetExportButton
            count={filtered.length}
            run={() => exportPriceCheck(filtered.map((p) => p.id))}
          />
          <label className="ml-auto flex items-center gap-1.5 text-xs text-foreground/70">
            <input type="checkbox" checked={onlyChecking} onChange={(e) => setOnlyChecking(e.target.checked)} />
            Только на проверке
          </label>
        </div>
        <CrmTableScroll className="mt-3">
          <table className="w-full text-sm">
            <thead className={STICKY_THEAD}>
              <tr className="text-left text-foreground/50">
                {COLUMNS.map((c) => (
                  <th key={c.key} className="py-2 pr-3">
                    {c.label}
                  </th>
                ))}
              </tr>
              <tr className="text-left">
                {COLUMNS.map((c) => (
                  <th key={c.key} className="pb-2 pr-3">
                    <input
                      value={filters[c.key]}
                      onChange={(e) => setFilters((prev) => ({ ...prev, [c.key]: e.target.value }))}
                      placeholder="Поиск..."
                      className={filterClass}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="py-4 text-foreground/40">
                    Ничего не найдено.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => choose(p.id)}
                    aria-selected={p.id === selectedId}
                    className={`cursor-pointer border-b border-foreground/10 transition-colors ${
                      p.id === selectedId ? "bg-foreground/10" : "hover:bg-foreground/5"
                    }`}
                  >
                    <td className="py-2 pr-3 text-foreground/70">{p.brand ?? "—"}</td>
                    <td className="py-2 pr-3">
                      {p.name}
                      {p.checking > 0 && (
                        <span
                          title={`Позиций в «Проверке заказа»: ${p.checking}`}
                          className="ml-1.5 inline-block rounded-full bg-orange-500/15 px-1.5 text-[11px] font-medium text-orange-600 dark:text-orange-400"
                        >
                          проверка {p.checking}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3">{p.sku}</td>
                    <td className="whitespace-nowrap py-2 pr-3 text-foreground/60">{day(p.updatedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CrmTableScroll>
      </section>

      {/* Offers of the chosen article: the other half */}
      <section className="flex min-h-0 w-1/2 min-w-0 flex-col">
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setEditing("new")}
            disabled={!selected}
            aria-label="Добавить предложение"
            title={selected ? "Добавить предложение" : "Сначала выберите номенклатуру"}
            className="flex h-8 w-8 items-center justify-center rounded-md bg-green-600 text-lg font-bold leading-none text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setImporting(true)}
            className="rounded-md border border-foreground/20 px-3 py-1.5 text-sm font-medium hover:bg-foreground/5"
          >
            Загрузить из Excel
          </button>
          <h2 className="ml-2 min-w-0 truncate text-lg font-semibold">
            {selected ? (
              <>
                {selected.name} <span className="font-normal text-foreground/50">· {selected.sku}</span>
              </>
            ) : (
              "Предложения"
            )}
          </h2>
        </div>

        {!selected ? (
          <p className="mt-6 text-sm text-foreground/40">Выберите номенклатуру слева — здесь появятся предложения поставщиков.</p>
        ) : offers === null ? (
          <p className="mt-6 text-sm text-foreground/50">Загрузка...</p>
        ) : offers.length === 0 ? (
          <p className="mt-6 text-sm text-foreground/40">Предложений пока нет — добавьте кнопкой «+» или загрузкой из Excel.</p>
        ) : (
          <CrmTableScroll className="mt-3">
            <table className="w-full text-sm">
              <thead className={STICKY_THEAD}>
                <tr className="text-left text-foreground/50">
                  <th className="py-2 pr-4">Поставщик</th>
                  <th className="py-2 pr-4">Цена</th>
                  <th className="py-2 pr-4">Срок поставки</th>
                  <th className="py-2 pr-4">Качество</th>
                  <th className="py-2 pr-4">Дата обновления</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {offers.map((o) => (
                  <tr
                    key={o.id}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("a, button")) return;
                      setEditing(o);
                    }}
                    title="Изменить предложение"
                    className="cursor-pointer border-b border-foreground/10 transition-colors hover:bg-foreground/5"
                  >
                    <td className="py-2 pr-4">
                      {o.supplierName ?? "—"}
                      {o.selected && (
                        <span className="ml-1.5 rounded-full bg-green-600/10 px-1.5 text-[11px] font-medium text-green-700 dark:text-green-500">
                          на сайте
                        </span>
                      )}
                      {o.fileUrl && (
                        <a
                          href={o.fileUrl}
                          target="_blank"
                          rel="noopener"
                          title={o.fileName ?? "Файл"}
                          className="ml-1.5 text-foreground/50 hover:text-foreground"
                        >
                          📎
                        </a>
                      )}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-4 font-medium">{formatRubPrecise(o.price)}</td>
                    <td className="whitespace-nowrap py-2 pr-4">{days(o.deliveryDays)}</td>
                    <td className="py-2 pr-4">{o.quality ?? "—"}</td>
                    <td className="whitespace-nowrap py-2 pr-4 text-foreground/60">{day(o.priceUpdatedAt)}</td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setOrdering(o)}
                        className="whitespace-nowrap rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90"
                      >
                        Заказать
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CrmTableScroll>
        )}
      </section>

      {editing && selected && (
        <OfferModal
          productId={selected.id}
          offer={editing === "new" ? null : editing}
          suppliers={suppliers}
          onClose={() => setEditing(null)}
          onSaved={afterChange}
        />
      )}
      {ordering && <OrderModal offer={ordering} onClose={() => setOrdering(null)} />}
      {importing && (
        <ImportModal
          suppliers={suppliers}
          onClose={() => setImporting(false)}
          onDone={() => {
            if (selectedId) loadOffers(selectedId);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
