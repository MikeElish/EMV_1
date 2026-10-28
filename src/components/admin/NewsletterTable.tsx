"use client";

import { useMemo, useState } from "react";
import { exportSubscribers } from "@/actions/admin/newsletter";
import { TableSearchInput } from "@/components/admin/TableSearchInput";
import { SheetExportButton } from "@/components/admin/SheetExportButton";
import { CrmTableScroll, STICKY_THEAD } from "@/components/admin/CrmTableFrame";

type Status = "active" | "pending" | "unsubscribed";
type Row = { id: string; email: string; who: string; source: string; consentAt: string; consentIp: string; status: Status };

const STATUS: Record<Status, { label: string; className: string }> = {
  active: { label: "Подписан", className: "text-green-600" },
  pending: { label: "Ждёт подтверждения", className: "text-amber-600" },
  unsubscribed: { label: "Отписался", className: "text-foreground/40" },
};

/** CRM → Рассылка: who agreed to the shop's news, when and from where. */
export function NewsletterTable({ rows }: { rows: Row[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Status | "">("");

  const shown = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter(
      (r) => (!status || r.status === status) && (!query || `${r.email} ${r.who}`.toLowerCase().includes(query))
    );
  }, [rows, search, status]);
  const active = rows.filter((r) => r.status === "active").length;

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Рассылка</h1>
          <p className="text-xs text-foreground/50">
            Подписаны: {active} · всего согласий: {rows.length}. Писать можно только подписанным — в выгрузку попадают только они.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            aria-label="Статус"
            value={status}
            onChange={(e) => setStatus(e.target.value as Status | "")}
            className="rounded-md border border-foreground/20 bg-background px-2 py-1.5 text-sm"
          >
            <option value="">Все</option>
            {(Object.keys(STATUS) as Status[]).map((s) => (
              <option key={s} value={s}>
                {STATUS[s].label}
              </option>
            ))}
          </select>
          <TableSearchInput value={search} onChange={setSearch} placeholder="E-mail, имя, компания..." />
          <SheetExportButton count={active} run={exportSubscribers} />
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="mt-6 text-sm text-foreground/40">{rows.length ? "Ничего не найдено." : "Подписчиков пока нет."}</p>
      ) : (
        <CrmTableScroll className="mt-4">
          <table className="w-full text-sm">
            <thead className={STICKY_THEAD}>
              <tr className="text-left text-foreground/50">
                <th className="py-2 pr-3">E-mail</th>
                <th className="py-2 pr-3">Клиент</th>
                <th className="py-2 pr-3">Источник</th>
                <th className="py-2 pr-3">Согласие</th>
                <th className="py-2 pr-3">IP</th>
                <th className="py-2">Статус</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className="border-b border-foreground/10">
                  <td className="py-1.5 pr-3">{r.email}</td>
                  <td className="py-1.5 pr-3 text-foreground/70">{r.who || "—"}</td>
                  <td className="py-1.5 pr-3 text-foreground/70">{r.source}</td>
                  <td className="whitespace-nowrap py-1.5 pr-3 text-foreground/70">
                    {new Date(r.consentAt).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}
                  </td>
                  <td className="py-1.5 pr-3 text-foreground/50">{r.consentIp || "—"}</td>
                  <td className={`whitespace-nowrap py-1.5 ${STATUS[r.status].className}`}>{STATUS[r.status].label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CrmTableScroll>
      )}
    </>
  );
}
