"use client";

import { formatRub } from "@/lib/money";
import type { Period } from "@/lib/period";
import { PeriodPicker } from "@/components/admin/PeriodPicker";

type Tiles = {
  income: number;
  incomeVat: number;
  expense: number;
  expenseVat: number;
  total: number;
  totalVat: number;
  salary: number;
  ndfl: number;
  ndflRate: number;
  rest: number;
  taxPaid: number;
};
type Row = { id: string; date: string; kind: string; amount: number; vat: number; counterparty: string | null; purpose: string | null };

function Tile({ label, amount, vat, className, hint }: { label: string; amount: number; vat?: number; className: string; hint?: string }) {
  return (
    <div className={`rounded-lg border px-4 py-3 ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</span>
        {hint && <span className="text-[11px] opacity-70">{hint}</span>}
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <span className="whitespace-nowrap text-xl font-semibold tabular-nums">{formatRub(amount)}</span>
        {vat !== undefined && <span className="whitespace-nowrap text-sm tabular-nums opacity-80">НДС {formatRub(vat)}</span>}
      </div>
    </div>
  );
}

const day = (iso: string) => new Date(iso).toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" });

export function FinanceSummaryView({ period, tiles, rows }: { period: Period; tiles: Tiles; rows: Row[] }) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Сводный отчёт · {period.label}</h1>
        <PeriodPicker period={period} path="/admin/finance/summary" />
      </div>

      <div className="mt-6 flex flex-col-reverse gap-6 lg:flex-row">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground/70">Движение денег (выписки банков)</h2>
          {rows.length === 0 ? (
            <p className="mt-2 text-sm text-foreground/50">За период платежей нет. Выписки загружаются в Настройки → Банки.</p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-foreground/10 text-left text-xs text-foreground/50">
                    <th className="py-1.5 pr-3 font-normal">Дата</th>
                    <th className="py-1.5 pr-3 font-normal">Контрагент / назначение</th>
                    <th className="py-1.5 pr-3 text-right font-normal">Поступление</th>
                    <th className="py-1.5 pr-3 text-right font-normal">Затраты</th>
                    <th className="py-1.5 text-right font-normal">НДС</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-foreground/10 align-top">
                      <td className="whitespace-nowrap py-1.5 pr-3">{day(r.date)}</td>
                      <td className="py-1.5 pr-3">
                        <div>{r.counterparty ?? "—"}</div>
                        <div className="line-clamp-1 text-xs text-foreground/50" title={r.purpose ?? undefined}>
                          {r.kind === "tax" ? "Налоги (ЕНП) · " : ""}
                          {r.purpose}
                        </div>
                      </td>
                      <td className="whitespace-nowrap py-1.5 pr-3 text-right tabular-nums text-lime-700 dark:text-lime-400">{r.kind === "income" ? formatRub(r.amount) : ""}</td>
                      <td className={`whitespace-nowrap py-1.5 pr-3 text-right tabular-nums ${r.kind === "tax" ? "text-foreground/50" : "text-red-700 dark:text-red-400"}`}>
                        {r.kind !== "income" ? formatRub(r.amount) : ""}
                      </td>
                      <td className="whitespace-nowrap py-1.5 text-right tabular-nums text-foreground/60">{r.vat ? formatRub(r.vat) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="w-full shrink-0 space-y-3 lg:w-80">
          <Tile label="Поступление" amount={tiles.income} vat={tiles.incomeVat} className="border-lime-500/40 bg-lime-400/15 text-lime-800 dark:text-lime-300" />
          <Tile label="Затраты" amount={tiles.expense} vat={tiles.expenseVat} className="border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400" />
          <Tile label="Итого" amount={tiles.total} vat={tiles.totalVat} className="border-green-600/50 bg-green-600/15 text-green-800 dark:text-green-400" />
          <Tile label="Зарплата" amount={tiles.salary} className="border-blue-500/40 bg-blue-500/10 text-blue-800 dark:text-blue-300" />
          <Tile label="НДФЛ" amount={tiles.ndfl} hint={`ставка ${tiles.ndflRate}%`} className="border-foreground/15 bg-foreground/[0.03]" />
          <Tile label="Остаток" amount={tiles.rest} className="border-foreground/30 bg-foreground/[0.06] font-medium" />
          <p className="text-xs text-foreground/50">
            Остаток = Итого − НДС к уплате − Зарплата − НДФЛ. Переводы между своими счетами не учитываются; уплаченные налоги (ЕНП{" "}
            {formatRub(tiles.taxPaid)}) — в «Налогах», не в затратах.
          </p>
        </div>
      </div>
    </div>
  );
}
