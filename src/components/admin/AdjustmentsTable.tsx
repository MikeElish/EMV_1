"use client";

import { useMemo, useState } from "react";
import { formatRub } from "@/lib/money";
import { TableSearchInput } from "@/components/admin/TableSearchInput";
import { CrmTableScroll, STICKY_THEAD } from "@/components/admin/CrmTableFrame";
import { AdjustmentModal } from "@/components/admin/StockDocForms";
import { useRememberedState } from "@/components/admin/AdminPlaces";

type Doc = {
  ref: string;
  kind: "Списание" | "Оприходование";
  number: string;
  date: string;
  posted: boolean;
  deleted: boolean;
  warehouse: string;
  lines: number;
  sum: number;
  comment: string;
};

const dateRu = (s: string) => `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}`;

/** Склад → Списание/Оприходование: the documents in 1С and «+» for a new one. */
export function AdjustmentsTable({ warehouses, docs }: { warehouses: { ref: string; name: string }[]; docs: Doc[] }) {
  const [search, setSearch] = useRememberedState("search", "");
  const [creating, setCreating] = useState(false);

  const shown = useMemo(() => {
    const query = search.trim().toLowerCase();
    return docs.filter((d) => !query || `${d.kind} ${d.number} ${d.warehouse} ${d.comment}`.toLowerCase().includes(query));
  }, [docs, search]);

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Списание / Оприходование</h1>
        <div className="flex items-center gap-3">
          <TableSearchInput value={search} onChange={setSearch} placeholder="Номер, склад, комментарий..." />
          <button
            type="button"
            onClick={() => setCreating(true)}
            aria-label="Создать документ"
            title="Создать списание или оприходование"
            className="h-9 w-9 rounded-md bg-foreground text-lg font-medium leading-none text-background hover:opacity-90"
          >
            +
          </button>
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="mt-6 text-sm text-foreground/40">{docs.length ? "Ничего не найдено." : "Документов пока нет."}</p>
      ) : (
        <CrmTableScroll className="mt-4">
          <table className="w-full text-sm">
            <thead className={STICKY_THEAD}>
              <tr className="text-left text-foreground/50">
                <th className="py-2 pr-3">Дата</th>
                <th className="py-2 pr-3">Документ</th>
                <th className="py-2 pr-3">Склад</th>
                <th className="py-2 pr-3 text-right">Позиций</th>
                <th className="py-2 pr-3 text-right">Сумма</th>
                <th className="py-2 pr-3">Комментарий</th>
                <th className="py-2">Статус</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((d) => (
                <tr key={d.ref} className={`border-b border-foreground/10 ${d.deleted ? "text-foreground/40" : ""}`}>
                  <td className="whitespace-nowrap py-1.5 pr-3">{dateRu(d.date)}</td>
                  <td className="whitespace-nowrap py-1.5 pr-3">
                    <span className={d.kind === "Списание" ? "text-red-600" : "text-green-700 dark:text-green-400"}>{d.kind}</span> №{" "}
                    {d.number}
                  </td>
                  <td className="py-1.5 pr-3">{d.warehouse}</td>
                  <td className="py-1.5 pr-3 text-right">{d.lines}</td>
                  <td className="whitespace-nowrap py-1.5 pr-3 text-right">{d.sum ? formatRub(Math.round(d.sum * 100)) : "—"}</td>
                  <td className="max-w-72 truncate py-1.5 pr-3 text-foreground/70" title={d.comment}>
                    {d.comment || "—"}
                  </td>
                  <td className="whitespace-nowrap py-1.5 text-foreground/60">
                    {d.deleted ? "помечен на удаление" : d.posted ? "проведён" : "не проведён"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CrmTableScroll>
      )}

      {creating && (
        <AdjustmentModal warehouses={warehouses} defaultWarehouse={warehouses[0]?.ref ?? ""} onClose={() => setCreating(false)} />
      )}
    </>
  );
}
