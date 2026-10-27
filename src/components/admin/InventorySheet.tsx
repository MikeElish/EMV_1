"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createInventoryDoc, type DocsResult } from "@/actions/admin/warehouse";
import { TableSearchInput } from "@/components/admin/TableSearchInput";
import { CrmTableScroll, STICKY_THEAD } from "@/components/admin/CrmTableFrame";
import { CreatedNote, ItemPicker } from "@/components/admin/StockDocForms";
import { PlaceInput } from "@/components/admin/WarehouseTable";

type Row = { itemRef: string; name: string; sku: string; place: string; book: number; price: number | null };
type Count = { factText: string; priceText: string };

const num = (s: string) => Number(s.replace(",", ".").replace(/\s/g, ""));
const qtyText = (n: number) => n.toLocaleString("ru-RU", { maximumFractionDigits: 3 });

/**
 * Инвентаризация: «Учёт» from 1С, «Факт» typed while counting (starts equal
 * to the book quantity). Проведение creates the Инвентаризация in 1С and,
 * from it, Списание of shortages and Оприходование of surpluses.
 */
export function InventorySheet({ warehouse, rows: initial }: { warehouse: { ref: string; name: string }; rows: Row[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [counts, setCounts] = useState<Record<string, Count>>(() =>
    Object.fromEntries(initial.map((r) => [r.itemRef, { factText: String(Math.max(0, r.book)), priceText: r.price ? String(r.price) : "" }]))
  );
  const [search, setSearch] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DocsResult | null>(null);
  const [pending, startTransition] = useTransition();

  const diff = (r: Row) => {
    const fact = num(counts[r.itemRef]?.factText ?? "");
    return Number.isFinite(fact) ? Math.round((fact - Math.max(0, r.book)) * 1000) / 1000 : 0;
  };
  const shown = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((r) => !query || `${r.place} ${r.name} ${r.sku}`.toLowerCase().includes(query));
  }, [rows, search]);
  const shortages = rows.filter((r) => diff(r) < 0).length;
  const surpluses = rows.filter((r) => diff(r) > 0).length;

  const set = (ref: string, patch: Partial<Count>) => setCounts((prev) => ({ ...prev, [ref]: { ...prev[ref], ...patch } }));

  function submit() {
    setError(null);
    const lines: { itemRef: string; book: number; fact: number; price: number }[] = [];
    for (const r of rows) {
      const fact = num(counts[r.itemRef].factText);
      if (!(fact >= 0)) return setError(`Укажите фактическое количество: ${r.name}`);
      const price = num(counts[r.itemRef].priceText) || 0;
      if (fact > Math.max(0, r.book) && !(price > 0)) return setError(`Укажите цену излишка: ${r.name}`);
      lines.push({ itemRef: r.itemRef, book: r.book, fact, price });
    }
    if (!confirm(`Провести инвентаризацию в 1С? Недостач: ${shortages}, излишков: ${surpluses}.`)) return;
    startTransition(async () => {
      const r = await createInventoryDoc(warehouse.ref, lines, comment);
      setResult(r);
      if (r.ok) router.refresh();
    });
  }

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/admin/warehouse/${warehouse.ref}`} className="text-sm text-foreground/60 hover:underline">
            ← {warehouse.name}
          </Link>
          <h1 className="text-2xl font-bold">Инвентаризация</h1>
          <p className="mt-1 text-xs text-foreground/50">
            Впишите фактическое количество. Недостачи будут списаны, излишки оприходованы — документами 1С.
          </p>
        </div>
        <TableSearchInput value={search} onChange={setSearch} placeholder="Место, товар, артикул..." />
      </div>

      <div className="mt-3 max-w-xl shrink-0">
        <ItemPicker
          onPick={(item) => {
            if (rows.some((r) => r.itemRef === item.ref)) return;
            setRows((prev) => [...prev, { itemRef: item.ref, name: item.name, sku: item.sku, place: "", book: 0, price: item.price ?? null }]);
            set(item.ref, { factText: "1", priceText: item.price ? String(item.price) : "" });
          }}
        />
        <p className="mt-1 text-xs text-foreground/40">Нашли товар, которого нет в списке, — добавьте его (будет оприходован как излишек).</p>
      </div>

      <CrmTableScroll className="mt-4">
        <table className="w-full text-sm">
          <thead className={STICKY_THEAD}>
            <tr className="text-left text-foreground/50">
              <th className="py-2 pr-3">Место хранения</th>
              <th className="py-2 pr-3">Наименование</th>
              <th className="py-2 pr-3">Артикул</th>
              <th className="py-2 pr-3 text-right">Учёт</th>
              <th className="py-2 pr-3">Факт</th>
              <th className="py-2 pr-3 text-right">Расхождение</th>
              <th className="py-2">Цена излишка, ₽</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const d = diff(r);
              return (
                <tr key={r.itemRef} className="border-b border-foreground/10">
                  <td className="py-1 pr-3">
                    <PlaceInput warehouseRef={warehouse.ref} row={r} />
                  </td>
                  <td className="py-1 pr-3">{r.name}</td>
                  <td className="py-1 pr-3 text-foreground/70">{r.sku || "—"}</td>
                  <td className={`py-1 pr-3 text-right ${r.book < 0 ? "text-red-600" : ""}`}>{qtyText(r.book)}</td>
                  <td className="py-1 pr-3">
                    <input
                      aria-label={`Факт: ${r.name}`}
                      inputMode="decimal"
                      value={counts[r.itemRef]?.factText ?? ""}
                      onChange={(e) => set(r.itemRef, { factText: e.target.value })}
                      className="w-20 rounded border border-foreground/20 bg-transparent px-2 py-1"
                    />
                  </td>
                  <td className={`py-1 pr-3 text-right font-medium ${d < 0 ? "text-red-600" : d > 0 ? "text-green-700 dark:text-green-400" : "text-foreground/30"}`}>
                    {d > 0 ? `+${qtyText(d)}` : d < 0 ? qtyText(d) : "0"}
                  </td>
                  <td className="py-1">
                    {d > 0 && (
                      <input
                        aria-label={`Цена излишка: ${r.name}`}
                        inputMode="decimal"
                        value={counts[r.itemRef]?.priceText ?? ""}
                        onChange={(e) => set(r.itemRef, { priceText: e.target.value })}
                        className="w-24 rounded border border-foreground/20 bg-transparent px-2 py-1"
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CrmTableScroll>

      <div className="mt-4 flex shrink-0 flex-wrap items-center gap-3">
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Комментарий"
          maxLength={500}
          className="w-72 rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
        />
        <span className="text-sm text-foreground/60">
          Недостач: <b className="text-red-600">{shortages}</b>, излишков: <b className="text-green-700 dark:text-green-400">{surpluses}</b>
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={pending || !rows.length || result?.ok}
          className="rounded-md bg-foreground px-5 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Проводим в 1С..." : "Провести инвентаризацию"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {result && <CreatedNote result={result} />}
      </div>
    </>
  );
}
