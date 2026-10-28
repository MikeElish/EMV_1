"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { refreshWarehouseData } from "@/actions/admin/warehouse";
import { TableSearchInput } from "@/components/admin/TableSearchInput";
import { CrmTableScroll, STICKY_THEAD } from "@/components/admin/CrmTableFrame";
import { useRememberedState } from "@/components/admin/AdminPlaces";

type ItemCols = { itemRef: string; name: string; sku: string; productId: string | null };
export type SummaryRow = ItemCols & { opening: number; qtyIn: number; qtyOut: number; closing: number };
export type DocRow = ItemCols & { date: string; doc: string; party: string; warehouse: string; qtyIn: number; qtyOut: number };

const qty = (n: number) => (n ? n.toLocaleString("ru-RU", { maximumFractionDigits: 3 }) : "");
const dateRu = (s: string) => `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}`;
const inputClass = "rounded-md border border-foreground/20 bg-background px-2 py-1.5 text-sm";
const filterClass =
  "w-full min-w-16 rounded border border-foreground/20 bg-background px-1.5 py-0.5 text-xs font-normal outline-none focus:border-foreground/50";

/** «Поступление № 00-000012» → «Поступление». */
const docKind = (doc: string) => doc.split(" № ")[0];

type SummaryFilters = { name: string; sku: string; opening: string; qtyIn: string; qtyOut: string; closing: string };
type DocFilters = {
  date: string;
  kind: string;
  doc: string;
  party: string;
  warehouse: string;
  name: string;
  sku: string;
  dir: "" | "in" | "out";
  qtyIn: string;
  qtyOut: string;
};
const NO_SUMMARY: SummaryFilters = { name: "", sku: "", opening: "", qtyIn: "", qtyOut: "", closing: "" };
const NO_DOCS: DocFilters = { date: "", kind: "", doc: "", party: "", warehouse: "", name: "", sku: "", dir: "", qtyIn: "", qtyOut: "" };

/** A column filter: «=x» is exactly x, otherwise a part of the value. */
function fits(value: string, filter: string) {
  const f = filter.trim().toLowerCase();
  if (!f) return true;
  const v = value.toLowerCase();
  return f.startsWith("=") ? v === f.slice(1).trim() : v.includes(f);
}

function FilterInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="фильтр" aria-label={`Фильтр: ${label}`} className={filterClass} />
  );
}

function ItemName({ row }: { row: ItemCols }) {
  return row.productId ? (
    <Link href={`/admin/crm/products/${row.productId}/edit`} className="hover:underline">
      {row.name}
    </Link>
  ) : (
    <>{row.name}</>
  );
}

export function MovementsReport({
  from,
  to,
  view,
  warehouse,
  warehouses,
  summary,
  docs,
  loadedAt,
}: {
  from: string;
  to: string;
  view: "summary" | "docs";
  warehouse: string;
  warehouses: { ref: string; name: string }[];
  summary: SummaryRow[];
  docs: DocRow[];
  loadedAt: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useRememberedState("search", "");
  const [sf, setSf] = useRememberedState<SummaryFilters>("summary-filters", NO_SUMMARY);
  const [df, setDf] = useRememberedState<DocFilters>("doc-filters", NO_DOCS);
  const kinds = useMemo(() => [...new Set(docs.map((d) => docKind(d.doc)))].sort((a, b) => a.localeCompare(b, "ru")), [docs]);
  const setS = (key: keyof SummaryFilters) => (v: string) => setSf((f) => ({ ...f, [key]: v }));
  const setD = (key: keyof DocFilters) => (v: string) => setDf((f) => ({ ...f, [key]: v }));
  const [refreshing, startRefresh] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const href = (patch: Record<string, string>) => {
    const params = new URLSearchParams({ from, to, view, ...(warehouse ? { w: warehouse } : {}), ...patch });
    if (!params.get("w")) params.delete("w");
    return `/admin/reports/movements?${params}`;
  };

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    router.push(href({ from: String(form.get("from")), to: String(form.get("to")), w: String(form.get("w") ?? "") }));
  }

  function refresh() {
    setError(null);
    startRefresh(async () => {
      const result = await refreshWarehouseData();
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  /** Приход / Расход of a line of the Ведомость → its documents of that direction. */
  function openDocs(row: SummaryRow, dir: "in" | "out") {
    setDf({ ...NO_DOCS, sku: row.sku ? `=${row.sku}` : "", name: row.sku ? "" : `=${row.name}`, dir });
    router.push(href({ view: "docs" }));
  }

  const query = search.trim().toLowerCase();
  const summaryRows = useMemo(
    () =>
      summary.filter(
        (r) =>
          (!query || `${r.name} ${r.sku}`.toLowerCase().includes(query)) &&
          fits(r.name, sf.name) &&
          fits(r.sku, sf.sku) &&
          fits(qty(r.opening) || "0", sf.opening) &&
          fits(qty(r.qtyIn), sf.qtyIn) &&
          fits(qty(r.qtyOut), sf.qtyOut) &&
          fits(qty(r.closing) || "0", sf.closing)
      ),
    [summary, query, sf]
  );
  const docRows = useMemo(
    () =>
      docs.filter(
        (r) =>
          (!query || `${r.name} ${r.sku} ${r.doc} ${r.party}`.toLowerCase().includes(query)) &&
          fits(dateRu(r.date), df.date) &&
          (!df.kind || docKind(r.doc) === df.kind) &&
          fits(r.doc, df.doc) &&
          fits(r.party, df.party) &&
          fits(r.warehouse, df.warehouse) &&
          fits(r.name, df.name) &&
          fits(r.sku, df.sku) &&
          (df.dir !== "in" || r.qtyIn > 0) &&
          (df.dir !== "out" || r.qtyOut > 0) &&
          fits(qty(r.qtyIn), df.qtyIn) &&
          fits(qty(r.qtyOut), df.qtyOut)
      ),
    [docs, query, df]
  );
  const summaryFiltered = Object.values(sf).some(Boolean);
  const docsFiltered = Object.values(df).some(Boolean);
  const totals = summaryRows.reduce((t, r) => ({ in: t.in + r.qtyIn, out: t.out + r.qtyOut }), { in: 0, out: 0 });

  const tab = (key: "summary" | "docs", label: string) => (
    <Link
      href={href({ view: key })}
      className={`rounded-md px-3 py-1.5 text-sm font-medium ${
        view === key ? "bg-foreground text-background" : "text-foreground/60 hover:bg-foreground/5"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Движение товаров</h1>
          <p className="mt-1 text-xs text-foreground/50">
            По документам 1С (счета 41 «Товары»), данные на{" "}
            {new Date(loadedAt).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}
          </p>
        </div>
        <form onSubmit={apply} className="flex flex-wrap items-center gap-2" key={`${from}${to}${warehouse}`}>
          <label className="text-sm text-foreground/60">
            с <input type="date" name="from" defaultValue={from} required className={inputClass} />
          </label>
          <label className="text-sm text-foreground/60">
            по <input type="date" name="to" defaultValue={to} required className={inputClass} />
          </label>
          <select name="w" defaultValue={warehouse} aria-label="Склад" className={inputClass}>
            <option value="">Все склады</option>
            {warehouses.map((w) => (
              <option key={w.ref} value={w.ref}>
                {w.name}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-md bg-foreground px-4 py-1.5 text-sm font-medium text-background">
            Показать
          </button>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="rounded-md border border-foreground/20 px-3 py-1.5 text-sm font-medium hover:bg-foreground/5 disabled:opacity-50"
          >
            {refreshing ? "Обновляем..." : "Обновить из 1С"}
          </button>
        </form>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex shrink-0 flex-wrap items-center gap-2">
        {tab("summary", "Ведомость")}
        {tab("docs", "Документы")}
        {(view === "summary" ? summaryFiltered : docsFiltered) && (
          <button
            type="button"
            onClick={() => (view === "summary" ? setSf(NO_SUMMARY) : setDf(NO_DOCS))}
            className="rounded-md border border-foreground/20 px-3 py-1.5 text-sm hover:bg-foreground/5"
          >
            Сбросить фильтры
          </button>
        )}
        <div className="ml-auto">
          <TableSearchInput value={search} onChange={setSearch} placeholder="Товар, артикул, документ..." />
        </div>
      </div>

      {view === "summary" ? (
        summaryRows.length === 0 && !summaryFiltered ? (
          <p className="mt-6 text-sm text-foreground/40">За период движений нет.</p>
        ) : (
          <CrmTableScroll className="mt-4">
            <table className="w-full text-sm">
              <thead className={STICKY_THEAD}>
                <tr className="text-left text-foreground/50">
                  <th className="py-2 pr-3">Наименование</th>
                  <th className="py-2 pr-3">Артикул</th>
                  <th className="py-2 pr-3 text-right">Начало периода</th>
                  <th className="py-2 pr-3 text-right">Приход</th>
                  <th className="py-2 pr-3 text-right">Расход</th>
                  <th className="py-2 text-right">Конец периода</th>
                </tr>
                <tr>
                  <th className="pb-2 pr-3"><FilterInput value={sf.name} onChange={setS("name")} label="Наименование" /></th>
                  <th className="pb-2 pr-3"><FilterInput value={sf.sku} onChange={setS("sku")} label="Артикул" /></th>
                  <th className="pb-2 pr-3"><FilterInput value={sf.opening} onChange={setS("opening")} label="Начало периода" /></th>
                  <th className="pb-2 pr-3"><FilterInput value={sf.qtyIn} onChange={setS("qtyIn")} label="Приход" /></th>
                  <th className="pb-2 pr-3"><FilterInput value={sf.qtyOut} onChange={setS("qtyOut")} label="Расход" /></th>
                  <th className="pb-2"><FilterInput value={sf.closing} onChange={setS("closing")} label="Конец периода" /></th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((r) => (
                  <tr key={r.itemRef} className="border-b border-foreground/10">
                    <td className="py-1.5 pr-3">
                      <ItemName row={r} />
                    </td>
                    <td className="py-1.5 pr-3 text-foreground/70">{r.sku || "—"}</td>
                    <td className="py-1.5 pr-3 text-right">{qty(r.opening) || "0"}</td>
                    <td className="py-1.5 pr-3 text-right text-green-700 dark:text-green-400">
                      {r.qtyIn ? (
                        <button type="button" onClick={() => openDocs(r, "in")} title="Документы прихода" className="hover:underline">
                          {qty(r.qtyIn)}
                        </button>
                      ) : null}
                    </td>
                    <td className="py-1.5 pr-3 text-right text-red-600">
                      {r.qtyOut ? (
                        <button type="button" onClick={() => openDocs(r, "out")} title="Документы расхода" className="hover:underline">
                          {qty(r.qtyOut)}
                        </button>
                      ) : null}
                    </td>
                    <td className={`py-1.5 text-right font-medium ${r.closing < 0 ? "text-red-600" : ""}`}>
                      {qty(r.closing) || "0"}
                    </td>
                  </tr>
                ))}
                <tr className="font-medium">
                  <td className="py-2 pr-3" colSpan={3}>
                    Итого ({summaryRows.length} поз.)
                  </td>
                  <td className="py-2 pr-3 text-right">{qty(totals.in)}</td>
                  <td className="py-2 pr-3 text-right">{qty(totals.out)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </CrmTableScroll>
        )
      ) : docRows.length === 0 && !docsFiltered ? (
        <p className="mt-6 text-sm text-foreground/40">За период движений нет.</p>
      ) : (
        <CrmTableScroll className="mt-4">
          <table className="w-full text-sm">
            <thead className={STICKY_THEAD}>
              <tr className="text-left text-foreground/50">
                <th className="py-2 pr-3">Дата</th>
                <th className="py-2 pr-3">Вид документа</th>
                <th className="py-2 pr-3">Документ</th>
                <th className="py-2 pr-3">Контрагент / содержание</th>
                <th className="py-2 pr-3">Склад</th>
                <th className="py-2 pr-3">Наименование</th>
                <th className="py-2 pr-3">Артикул</th>
                <th className="py-2 pr-3 text-right">Приход</th>
                <th className="py-2 text-right">Расход</th>
              </tr>
              <tr className="align-top">
                <th className="pb-2 pr-3"><FilterInput value={df.date} onChange={setD("date")} label="Дата" /></th>
                <th className="pb-2 pr-3">
                  <select value={df.kind} onChange={(e) => setD("kind")(e.target.value)} aria-label="Фильтр: вид документа" className={filterClass}>
                    <option value="">все</option>
                    {kinds.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </th>
                <th className="pb-2 pr-3"><FilterInput value={df.doc} onChange={setD("doc")} label="Документ" /></th>
                <th className="pb-2 pr-3"><FilterInput value={df.party} onChange={setD("party")} label="Контрагент" /></th>
                <th className="pb-2 pr-3"><FilterInput value={df.warehouse} onChange={setD("warehouse")} label="Склад" /></th>
                <th className="pb-2 pr-3"><FilterInput value={df.name} onChange={setD("name")} label="Наименование" /></th>
                <th className="pb-2 pr-3"><FilterInput value={df.sku} onChange={setD("sku")} label="Артикул" /></th>
                <th className="pb-2 pr-3" colSpan={2}>
                  <select value={df.dir} onChange={(e) => setD("dir")(e.target.value)} aria-label="Фильтр: движение" className={filterClass}>
                    <option value="">приход и расход</option>
                    <option value="in">только приход</option>
                    <option value="out">только расход</option>
                  </select>
                  <div className="mt-1 flex gap-1">
                    <FilterInput value={df.qtyIn} onChange={setD("qtyIn")} label="Приход" />
                    <FilterInput value={df.qtyOut} onChange={setD("qtyOut")} label="Расход" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {docRows.map((r, i) => (
                <tr key={i} className="border-b border-foreground/10">
                  <td className="whitespace-nowrap py-1.5 pr-3">{dateRu(r.date)}</td>
                  <td className="whitespace-nowrap py-1.5 pr-3 text-foreground/70">{docKind(r.doc)}</td>
                  <td className="whitespace-nowrap py-1.5 pr-3">{r.doc}</td>
                  <td className="max-w-64 truncate py-1.5 pr-3 text-foreground/70" title={r.party}>
                    {r.party}
                  </td>
                  <td className="whitespace-nowrap py-1.5 pr-3 text-foreground/70">{r.warehouse}</td>
                  <td className="py-1.5 pr-3">
                    <ItemName row={r} />
                  </td>
                  <td className="py-1.5 pr-3 text-foreground/70">{r.sku || "—"}</td>
                  <td className="py-1.5 pr-3 text-right text-green-700 dark:text-green-400">{qty(r.qtyIn)}</td>
                  <td className="py-1.5 text-right text-red-600">{qty(r.qtyOut)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CrmTableScroll>
      )}
    </>
  );
}
