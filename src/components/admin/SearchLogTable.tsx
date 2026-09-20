"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { utils, write } from "xlsx";
import type { SearchLog, SearchLogDaily } from "@prisma/client";
import { TableSearchInput } from "@/components/admin/TableSearchInput";

type LogWithDaily = SearchLog & { dailyCounts: SearchLogDaily[] };

function buildExportHref(logs: LogWithDaily[]) {
  const header = ["Бренд", "Наименование", "Артикул", "Количество запросов", "Наличие в системе"];
  const body = logs.map((log) => [
    log.brand,
    log.name ?? "",
    log.sku,
    log.totalCount,
    log.inSystem ? "Да" : "Нет",
  ]);
  const worksheet = utils.aoa_to_sheet([header, ...body]);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, "Поиск");
  const base64 = write(workbook, { type: "base64", bookType: "xlsx" });
  return `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;
}

export function SearchLogTable({
  logs,
  brands,
  selectedBrand,
}: {
  logs: LogWithDaily[];
  brands: string[];
  selectedBrand: string;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const exportHref = buildExportHref(logs);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return logs;
    return logs.filter((log) =>
      [log.brand, log.name, log.sku].filter(Boolean).join(" ").toLowerCase().includes(query)
    );
  }, [logs, search]);

  return (
    <div>
      <div className="mt-6 flex items-center justify-between">
        <select
          value={selectedBrand}
          onChange={(e) => {
            const value = e.target.value;
            router.push(value ? `/admin/crm/search?brand=${encodeURIComponent(value)}` : "/admin/crm/search");
          }}
          className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
        >
          <option value="">Все бренды</option>
          {brands.map((brand) => (
            <option key={brand} value={brand}>
              {brand}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-3">
          <TableSearchInput value={search} onChange={setSearch} placeholder="Поиск по названию, артикулу..." />
          <a
            href={exportHref}
            download="poisk.xlsx"
            className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
          >
            Выгрузить
          </a>
        </div>
      </div>

      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b border-foreground/10 text-left text-foreground/50">
            <th className="py-2">Бренд</th>
            <th className="py-2">Наименование</th>
            <th className="py-2">Артикул</th>
            <th className="py-2">Количество запросов</th>
            <th className="py-2">Наличие в системе</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((log) => {
            const isOpen = openId === log.id;
            return (
              <Fragment key={log.id}>
                <tr
                  onClick={() => setOpenId(isOpen ? null : log.id)}
                  className="cursor-pointer border-b border-foreground/10 hover:bg-foreground/5"
                >
                  <td className="py-2">{log.brand}</td>
                  <td className="py-2">{log.name ?? "—"}</td>
                  <td className="py-2">{log.sku}</td>
                  <td className="py-2">{log.totalCount}</td>
                  <td className="py-2">{log.inSystem ? "Да" : "Нет"}</td>
                </tr>
                {isOpen && (
                  <tr className="border-b border-foreground/10 bg-foreground/[0.03]">
                    <td colSpan={5} className="px-2 py-3">
                      {log.dailyCounts.length === 0 ? (
                        <span className="text-foreground/40">Нет данных</span>
                      ) : (
                        <ul className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-foreground/70">
                          {log.dailyCounts.map((daily) => (
                            <li key={daily.id}>
                              {daily.date.toLocaleDateString("ru-RU")}: <strong>{daily.count}</strong>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>

      {filtered.length === 0 && <p className="mt-6 text-foreground/60">Ничего не найдено.</p>}
    </div>
  );
}
