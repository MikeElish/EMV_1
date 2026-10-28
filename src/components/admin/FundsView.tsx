"use client";

import { useState } from "react";
import Link from "next/link";
import { formatRub } from "@/lib/money";
import type { Period } from "@/lib/period";
import { FUNDS, FUND_LABELS, type Fund } from "@/lib/fund-labels";
import { PeriodPicker } from "@/components/admin/PeriodPicker";

type MonthFunds = { month: string; income: number; allocations: Record<Fund, number>; notes: Partial<Record<Fund, string>>; km: number | null };
type Move = { date: string; fund: Fund; text: string; in: number; out: number; href?: string };

const COLORS: Record<Fund, string> = {
  VAT: "border-lime-500/40 bg-lime-400/10",
  NDFL: "border-amber-500/40 bg-amber-400/10",
  SALARY: "border-blue-500/40 bg-blue-500/10",
  DEPRECIATION: "border-purple-500/40 bg-purple-500/10",
  LEASING: "border-cyan-500/40 bg-cyan-500/10",
  REPAIRS: "border-orange-500/40 bg-orange-500/10",
  FREE: "border-green-600/50 bg-green-600/15",
};
const ru = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

export function FundsView({ period, data, balances, moves }: { period: Period; data: MonthFunds; balances: Record<Fund, number>; moves: Move[] }) {
  const [fund, setFund] = useState<Fund | "">("");
  const shown = fund ? moves.filter((m) => m.fund === fund) : moves;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Фонды · {period.label}</h1>
        <PeriodPicker period={period} path="/admin/finance/funds" modes={["month"]} />
      </div>
      <p className="mt-1 text-xs text-foreground/50">
        Поступления месяца {formatRub(data.income)} распределяются по фондам; заявка на оплату списывает деньги со своего фонда и не оплачивается, если в
        нём не хватает.
      </p>

      <div className="mt-6 flex flex-col gap-6 lg:flex-row">
        <div className="w-full shrink-0 space-y-3 lg:w-96">
          {FUNDS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFund(fund === f ? "" : f)}
              className={`block w-full rounded-lg border px-4 py-3 text-left transition-opacity ${COLORS[f]} ${fund && fund !== f ? "opacity-50" : ""}`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className={`text-xs uppercase tracking-wide ${f === "FREE" ? "font-bold" : "font-semibold"}`}>{FUND_LABELS[f]}</span>
                <span className="whitespace-nowrap text-xs text-foreground/60">остаток {formatRub(balances[f])}</span>
              </div>
              <div className={`mt-1 whitespace-nowrap text-xl tabular-nums ${f === "FREE" ? "font-bold" : "font-semibold"}`}>{formatRub(data.allocations[f])}</div>
              {data.notes[f] && <div className="mt-0.5 text-[11px] text-foreground/60">{data.notes[f]}</div>}
            </button>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground/70">Движение по фондам{fund ? ` — ${FUND_LABELS[fund]}` : ""}</h2>
            {fund && (
              <button type="button" onClick={() => setFund("")} className="text-xs underline underline-offset-2">
                все фонды
              </button>
            )}
          </div>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-foreground/10 text-left text-xs text-foreground/50">
                  <th className="py-1.5 pr-3 font-normal">Дата</th>
                  <th className="py-1.5 pr-3 font-normal">Фонд / содержание</th>
                  <th className="py-1.5 pr-3 text-right font-normal">Поступление</th>
                  <th className="py-1.5 text-right font-normal">Списание</th>
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-foreground/40">
                      Движений нет.
                    </td>
                  </tr>
                ) : (
                  shown.map((m, i) => (
                    <tr key={i} className="border-b border-foreground/10 align-top">
                      <td className="whitespace-nowrap py-1.5 pr-3">{ru(m.date)}</td>
                      <td className="py-1.5 pr-3">
                        <div className="font-medium">{FUND_LABELS[m.fund]}</div>
                        <div className="text-xs text-foreground/60">
                          {m.href ? (
                            <Link href={m.href} className="hover:underline">
                              {m.text}
                            </Link>
                          ) : (
                            m.text
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap py-1.5 pr-3 text-right tabular-nums text-green-700 dark:text-green-400">{m.in ? formatRub(m.in) : ""}</td>
                      <td className="whitespace-nowrap py-1.5 text-right tabular-nums text-red-700 dark:text-red-400">{m.out ? formatRub(m.out) : ""}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
