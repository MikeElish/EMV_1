"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Period, PeriodMode } from "@/lib/period";

const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const LABELS: Record<PeriodMode, string> = { dates: "Даты", month: "Месяц", quarter: "Квартал", year: "Год" };
const inputClass = "rounded-md border border-foreground/20 bg-background px-2 py-1.5 text-sm";

/** «Период»: dates, a month, a quarter or a year -- into the address (src/lib/period.ts). */
export function PeriodPicker({ period, path, modes = ["dates", "month", "quarter", "year"], extra = {} }: { period: Period; path: string; modes?: PeriodMode[]; extra?: Record<string, string> }) {
  const router = useRouter();
  const [mode, setMode] = useState<PeriodMode>(period.mode);
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => thisYear + 1 - i);

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams({ ...extra, p: mode });
    for (const k of ["y", "m", "q", "from", "to"]) {
      const v = form.get(k);
      if (typeof v === "string" && v) params.set(k, v);
    }
    router.push(`${path}?${params}`);
  }

  return (
    <form onSubmit={apply} className="flex flex-wrap items-center gap-2" key={`${period.mode}${period.from}${period.to}`}>
      {modes.length > 1 && (
        <div className="flex rounded-md border border-foreground/20 p-0.5">
          {modes.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded px-2.5 py-1 text-sm ${mode === m ? "bg-foreground text-background" : "text-foreground/60 hover:bg-foreground/5"}`}
            >
              {LABELS[m]}
            </button>
          ))}
        </div>
      )}
      {mode === "dates" ? (
        <>
          <input type="date" name="from" defaultValue={period.from} required aria-label="С" className={inputClass} />
          <span className="text-sm text-foreground/50">—</span>
          <input type="date" name="to" defaultValue={period.to} required aria-label="По" className={inputClass} />
        </>
      ) : (
        <>
          {mode === "month" && (
            <select name="m" defaultValue={period.m} aria-label="Месяц" className={inputClass}>
              {MONTHS.map((name, i) => (
                <option key={name} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
          )}
          {mode === "quarter" && (
            <select name="q" defaultValue={period.q} aria-label="Квартал" className={inputClass}>
              {[1, 2, 3, 4].map((q) => (
                <option key={q} value={q}>
                  {q} квартал
                </option>
              ))}
            </select>
          )}
          <select name="y" defaultValue={period.y} aria-label="Год" className={inputClass}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </>
      )}
      <button type="submit" className="rounded-md bg-foreground px-4 py-1.5 text-sm font-medium text-background hover:opacity-90">
        Показать
      </button>
    </form>
  );
}
