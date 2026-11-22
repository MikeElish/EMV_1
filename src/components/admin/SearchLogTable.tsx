"use client";

import { CrmPage, CrmTableScroll, STICKY_THEAD } from "@/components/admin/CrmTableFrame";
import { Fragment, useMemo, useState } from "react";
import { utils, write } from "xlsx";
import type { SearchLog, SearchLogDaily } from "@prisma/client";
import { TableSearchInput } from "@/components/admin/TableSearchInput";
import { useRememberedState } from "@/components/admin/AdminPlaces";

type LogWithDaily = SearchLog & { dailyCounts: SearchLogDaily[] };

const filterInputClassName =
  "w-full rounded-md border border-foreground/20 bg-transparent px-2 py-1 text-xs outline-none focus:border-foreground/50";

type Filters = {
  brand: string;
  name: string;
  sku: string;
  totalCount: string;
  inSystem: "all" | "yes" | "no";
  lastDate: string;
};

type SortBy = "dateDesc" | "countDesc" | "nameAsc" | "brandAsc";

const EMPTY_FILTERS: Filters = {
  brand: "",
  name: "",
  sku: "",
  totalCount: "",
  inSystem: "all",
  lastDate: "",
};

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("ru-RU");
}

function getLastDate(dailyCounts: SearchLogDaily[]): Date | null {
  if (dailyCounts.length === 0) return null;
  const maxTime = Math.max(...dailyCounts.map((d) => new Date(d.date).getTime()));
  return new Date(maxTime);
}

function buildExportHref(logs: LogWithDaily[]) {
  const header = ["Бренд", "Наименование", "Артикул", "Количество запросов", "Наличие в системе", "Последняя дата"];
  const body = logs.map((log) => [
    log.brand,
    log.name ?? "",
    log.sku,
    log.totalCount,
    log.inSystem ? "Да" : "Нет",
    formatDate(getLastDate(log.dailyCounts)),
  ]);
  const worksheet = utils.aoa_to_sheet([header, ...body]);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, "Поиск");
  const base64 = write(workbook, { type: "base64", bookType: "xlsx" });
  return `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;
}

export function SearchLogTable({ logs }: { logs: LogWithDaily[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [search, setSearch] = useRememberedState("search", "");
  const [filters, setFilters] = useRememberedState<Filters>("filters", EMPTY_FILTERS);
  const [sortBy, setSortBy] = useRememberedState<SortBy>("sort", "dateDesc");

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const hasActiveFilters = useMemo(() => {
    return Object.entries(filters).some(([key, value]) => (key === "inSystem" ? value !== "all" : Boolean(value)));
  }, [filters]);

  const prepared = useMemo(() => {
    const query = search.trim().toLowerCase();
    return logs
      .map((log) => ({ log, lastDate: getLastDate(log.dailyCounts) }))
      .filter(({ log, lastDate }) => {
        if (query) {
          const haystack = [log.brand, log.name, log.sku].filter(Boolean).join(" ").toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        if (filters.brand && !log.brand.toLowerCase().includes(filters.brand.trim().toLowerCase())) return false;
        if (filters.name && !(log.name ?? "").toLowerCase().includes(filters.name.trim().toLowerCase())) return false;
        if (filters.sku && !log.sku.toLowerCase().includes(filters.sku.trim().toLowerCase())) return false;
        if (filters.totalCount && !String(log.totalCount).includes(filters.totalCount.trim())) return false;
        if (filters.inSystem !== "all") {
          const expected = filters.inSystem === "yes";
          if (log.inSystem !== expected) return false;
        }
        if (filters.lastDate) {
          if (!formatDate(lastDate).includes(filters.lastDate.trim())) return false;
        }
        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "countDesc":
            return b.log.totalCount - a.log.totalCount;
          case "nameAsc":
            return (a.log.name ?? "").localeCompare(b.log.name ?? "", "ru");
          case "brandAsc":
            return a.log.brand.localeCompare(b.log.brand, "ru");
          case "dateDesc":
          default: {
            const ta = a.lastDate?.getTime() ?? 0;
            const tb = b.lastDate?.getTime() ?? 0;
            return tb - ta;
          }
        }
      });
  }, [logs, search, filters, sortBy]);

  const exportHref = buildExportHref(prepared.map((p) => p.log));

  return (
    <CrmPage>
      <div className="mt-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          >
            <option value="dateDesc">По дате (новые — старые)</option>
            <option value="countDesc">По количеству</option>
            <option value="nameAsc">По наименованию (а-я)</option>
            <option value="brandAsc">По бренду (а-я)</option>
          </select>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="text-sm text-foreground/50 hover:text-foreground"
            >
              Сбросить фильтры
            </button>
          )}
        </div>

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

      <CrmTableScroll className="mt-6">
        <table className="w-full text-sm">
          <thead className={STICKY_THEAD}>
            <tr className="border-b border-foreground/10 text-left text-foreground/50">
              <th className="py-2 pr-4">Бренд</th>
              <th className="py-2 pr-4">Наименование</th>
              <th className="py-2 pr-4">Артикул</th>
              <th className="py-2 pr-4">Количество запросов</th>
              <th className="py-2 pr-4">Наличие в системе</th>
              <th className="py-2 pr-4">Дата</th>
            </tr>
            <tr className="text-left">
              <th className="pb-2 pr-4">
                <input
                  type="text"
                  value={filters.brand}
                  onChange={(e) => setFilter("brand", e.target.value)}
                  placeholder="Поиск..."
                  className={filterInputClassName}
                />
              </th>
              <th className="pb-2 pr-4">
                <input
                  type="text"
                  value={filters.name}
                  onChange={(e) => setFilter("name", e.target.value)}
                  placeholder="Поиск..."
                  className={filterInputClassName}
                />
              </th>
              <th className="pb-2 pr-4">
                <input
                  type="text"
                  value={filters.sku}
                  onChange={(e) => setFilter("sku", e.target.value)}
                  placeholder="Поиск..."
                  className={filterInputClassName}
                />
              </th>
              <th className="pb-2 pr-4">
                <input
                  type="text"
                  value={filters.totalCount}
                  onChange={(e) => setFilter("totalCount", e.target.value)}
                  placeholder="Поиск..."
                  className={filterInputClassName}
                />
              </th>
              <th className="pb-2 pr-4">
                <select
                  value={filters.inSystem}
                  onChange={(e) => setFilter("inSystem", e.target.value as Filters["inSystem"])}
                  className={`${filterInputClassName} bg-background`}
                >
                  <option value="all">Все</option>
                  <option value="yes">Да</option>
                  <option value="no">Нет</option>
                </select>
              </th>
              <th className="pb-2 pr-4">
                <input
                  type="text"
                  value={filters.lastDate}
                  onChange={(e) => setFilter("lastDate", e.target.value)}
                  placeholder="дд.мм.гггг"
                  className={filterInputClassName}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {prepared.map(({ log, lastDate }) => {
              const isOpen = openId === log.id;
              return (
                <Fragment key={log.id}>
                  <tr
                    onClick={() => setOpenId(isOpen ? null : log.id)}
                    className="cursor-pointer border-b border-foreground/10 hover:bg-foreground/5"
                  >
                    <td className="py-2 pr-4">{log.brand}</td>
                    <td className="py-2 pr-4">{log.name ?? "—"}</td>
                    <td className="py-2 pr-4">{log.sku}</td>
                    <td className="py-2 pr-4">{log.totalCount}</td>
                    <td className="py-2 pr-4">{log.inSystem ? "Да" : "Нет"}</td>
                    <td className="py-2 pr-4">{formatDate(lastDate)}</td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-foreground/10 bg-foreground/[0.03]">
                      <td colSpan={6} className="px-2 py-3">
                        {log.dailyCounts.length === 0 ? (
                          <span className="text-foreground/40">Нет данных</span>
                        ) : (
                          <ul className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-foreground/70">
                            {log.dailyCounts.map((daily) => (
                              <li key={daily.id}>
                                {formatDate(daily.date)}: <strong>{daily.count}</strong>
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
      </CrmTableScroll>

      {prepared.length === 0 && <p className="mt-6 text-foreground/60">Ничего не найдено.</p>}
    </CrmPage>
  );
}
