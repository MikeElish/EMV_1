"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { refreshWarehouseData, setStoragePlace } from "@/actions/admin/warehouse";
import { TableSearchInput } from "@/components/admin/TableSearchInput";
import { CrmTableScroll, STICKY_THEAD } from "@/components/admin/CrmTableFrame";
import { TransferModal } from "@/components/admin/StockDocForms";
import { useRememberedState } from "@/components/admin/AdminPlaces";

type Row = { itemRef: string; name: string; sku: string; qty: number; place: string; productId: string | null };
type Warehouse = { ref: string; name: string };

const qtyText = (n: number) => n.toLocaleString("ru-RU", { maximumFractionDigits: 3 });

/** Место хранения, saved when the field is left. */
export function PlaceInput({ warehouseRef, row }: { warehouseRef: string; row: Pick<Row, "itemRef" | "name" | "place"> }) {
  const [value, setValue] = useState(row.place);
  const [saved, setSaved] = useState(row.place);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    if (value.trim() === saved) return;
    startTransition(async () => {
      const result = await setStoragePlace(warehouseRef, row.itemRef, value);
      if (result.ok) {
        setSaved(value.trim());
        setError(null);
      } else setError(result.error);
    });
  }

  return (
    <div>
      <input
        aria-label={`Место хранения: ${row.name}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setValue(saved);
        }}
        placeholder="—"
        maxLength={100}
        className={`w-32 rounded border bg-transparent px-2 py-1 text-sm outline-none focus:border-foreground/50 ${
          error ? "border-red-500" : "border-transparent hover:border-foreground/20"
        } ${pending ? "opacity-50" : ""}`}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function WarehouseTable({
  warehouse,
  warehouses,
  rows,
  loadedAt,
}: {
  warehouse: Warehouse;
  warehouses: Warehouse[];
  rows: Row[];
  loadedAt: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useRememberedState("search", "");
  const [refreshing, startRefresh] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [transfer, setTransfer] = useState(false);

  const sorted = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows
      .filter((r) => !query || `${r.place} ${r.name} ${r.sku}`.toLowerCase().includes(query))
      // By place, so the list follows the shelves; items without one go last.
      .sort(
        (a, b) =>
          Number(!a.place) - Number(!b.place) ||
          a.place.localeCompare(b.place, "ru", { numeric: true }) ||
          a.name.localeCompare(b.name, "ru")
      );
  }, [rows, search]);

  function refresh() {
    setError(null);
    startRefresh(async () => {
      const result = await refreshWarehouseData();
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  const negative = rows.filter((r) => r.qty < 0).length;

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{warehouse.name}</h1>
          <p className="mt-1 text-xs text-foreground/50">
            Остатки по документам 1С на {new Date(loadedAt).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Phones and tablets: the warehouse tabs are hidden, pick it here. */}
          {warehouses.length > 1 && (
            <select
              aria-label="Склад"
              value={warehouse.ref}
              onChange={(e) => router.push(`/admin/warehouse/${e.target.value}`)}
              className="rounded-md border border-foreground/20 bg-background px-2 py-1.5 text-sm lg:hidden"
            >
              {warehouses.map((w) => (
                <option key={w.ref} value={w.ref}>
                  {w.name}
                </option>
              ))}
            </select>
          )}
          <TableSearchInput value={search} onChange={setSearch} placeholder="Место, товар, артикул..." />
          <button
            type="button"
            onClick={() => setTransfer(true)}
            className="rounded-md bg-foreground px-4 py-1.5 text-sm font-medium text-background hover:opacity-90"
          >
            Создать перемещение
          </button>
          <Link
            href={`/admin/warehouse/${warehouse.ref}/inventory`}
            className="rounded-md border border-foreground/20 px-4 py-1.5 text-sm font-medium hover:bg-foreground/5"
          >
            Инвентаризация
          </Link>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="rounded-md border border-foreground/20 px-4 py-1.5 text-sm font-medium hover:bg-foreground/5 disabled:opacity-50"
          >
            {refreshing ? "Обновляем..." : "Обновить из 1С"}
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {negative > 0 && (
        <p className="mt-2 shrink-0 text-xs text-foreground/50">
          Отрицательное количество ({negative} поз.) — отгружено больше, чем оприходовано: в 1С не хватает документа
          поступления.
        </p>
      )}

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-foreground/40">На этом складе ничего нет.</p>
      ) : sorted.length === 0 ? (
        <p className="mt-6 text-sm text-foreground/40">Ничего не найдено.</p>
      ) : (
        <CrmTableScroll className="mt-4">
          <table className="w-full text-sm">
            <thead className={STICKY_THEAD}>
              <tr className="text-left text-foreground/50">
                <th className="py-2 pr-3">Место хранения</th>
                <th className="py-2 pr-3">Наименование</th>
                <th className="py-2 pr-3">Артикул</th>
                <th className="py-2 text-right">Количество</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.itemRef} className="border-b border-foreground/10">
                  <td className="py-1 pr-3">
                    <PlaceInput warehouseRef={warehouse.ref} row={r} />
                  </td>
                  <td className="py-1 pr-3">
                    {r.productId ? (
                      <Link href={`/admin/crm/products/${r.productId}/edit`} className="hover:underline">
                        {r.name}
                      </Link>
                    ) : (
                      r.name
                    )}
                  </td>
                  <td className="py-1 pr-3 text-foreground/70">{r.sku || "—"}</td>
                  <td className={`py-1 text-right font-medium ${r.qty < 0 ? "text-red-600" : ""}`}>{qtyText(r.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CrmTableScroll>
      )}

      {transfer && (
        <TransferModal
          warehouse={warehouse}
          warehouses={warehouses}
          stock={rows.filter((r) => r.qty > 0).map((r) => ({ ref: r.itemRef, name: r.name, sku: r.sku, qty: r.qty }))}
          onClose={() => setTransfer(false)}
        />
      )}
    </>
  );
}
