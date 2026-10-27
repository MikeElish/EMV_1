"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { refreshWarehouseData } from "@/actions/admin/warehouse";
import { TableSearchInput } from "@/components/admin/TableSearchInput";
import { CrmTableScroll, STICKY_THEAD } from "@/components/admin/CrmTableFrame";

type ItemCols = { itemRef: string; name: string; sku: string; productId: string | null };
export type SummaryRow = ItemCols & { opening: number; qtyIn: number; qtyOut: number; closing: number };
export type DocRow = ItemCols & { date: string; doc: string; party: string; warehouse: string; qtyIn: number; qtyOut: number };

const qty = (n: number) => (n ? n.toLocaleString("ru-RU", { maximumFractionDigits: 3 }) : "");
const dateRu = (s: string) => `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}`;
const inputClass = "rounded-md border border-foreground/20 bg-background px-2 py-1.5 text-sm";

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
  const [search, setSearch] = useState("");
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

  const query = search.trim().toLowerCase();
  const summaryRows = useMemo(
    () => summary.filter((r) => !query || `${r.name} ${r.sku}`.toLowerCase().includes(query)),
    [summary, query]
  );
  const docRows = useMemo(
    () => docs.filter((r) => !query || `${r.name} ${r.sku} ${r.doc} ${r.party}`.toLowerCase().includes(query)),
    [docs, query]
  );
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
        <div className="ml-auto">
          <TableSearchInput value={search} onChange={setSearch} placeholder="Товар, артикул, документ..." />
        </div>
      </div>

      {view === "summary" ? (
        summaryRows.length === 0 ? (
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
              </thead>
              <tbody>
                {summaryRows.map((r) => (
                  <tr key={r.itemRef} className="border-b border-foreground/10">
                    <td className="py-1.5 pr-3">
                      <ItemName row={r} />
                    </td>
                    <td className="py-1.5 pr-3 text-foreground/70">{r.sku || "—"}</td>
                    <td className="py-1.5 pr-3 text-right">{qty(r.opening) || "0"}</td>
                    <td className="py-1.5 pr-3 text-right text-green-700 dark:text-green-400">{qty(r.qtyIn)}</td>
                    <td className="py-1.5 pr-3 text-right text-red-600">{qty(r.qtyOut)}</td>
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
      ) : docRows.length === 0 ? (
        <p className="mt-6 text-sm text-foreground/40">За период движений нет.</p>
      ) : (
        <CrmTableScroll className="mt-4">
          <table className="w-full text-sm">
            <thead className={STICKY_THEAD}>
              <tr className="text-left text-foreground/50">
                <th className="py-2 pr-3">Дата</th>
                <th className="py-2 pr-3">Документ</th>
                <th className="py-2 pr-3">Контрагент / содержание</th>
                <th className="py-2 pr-3">Склад</th>
                <th className="py-2 pr-3">Наименование</th>
                <th className="py-2 pr-3">Артикул</th>
                <th className="py-2 pr-3 text-right">Приход</th>
                <th className="py-2 text-right">Расход</th>
              </tr>
            </thead>
            <tbody>
              {docRows.map((r, i) => (
                <tr key={i} className="border-b border-foreground/10">
                  <td className="whitespace-nowrap py-1.5 pr-3">{dateRu(r.date)}</td>
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
