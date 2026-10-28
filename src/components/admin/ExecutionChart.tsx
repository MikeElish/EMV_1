"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatRub } from "@/lib/money";
import { MONTH_NAMES, type Period } from "@/lib/period";
import { PeriodPicker } from "@/components/admin/PeriodPicker";

const W = 900;
const H = 380;
const PAD = { left: 84, right: 24, top: 20, bottom: 40 };
const ANIMATION_MS = 1400;

const short = (k: number) => {
  const r = k / 100;
  return Math.abs(r) >= 1_000_000 ? `${(r / 1_000_000).toFixed(1).replace(".", ",")} млн` : Math.abs(r) >= 1000 ? `${Math.round(r / 1000)} тыс` : `${Math.round(r)}`;
};

/** A round step for about five grid lines. */
function niceStep(max: number) {
  const raw = max / 5;
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  return [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
}

export function ExecutionChart({
  period,
  employees,
  employeeId,
  points,
  plan,
}: {
  period: Period;
  employees: { id: string; name: string }[];
  employeeId: string;
  points: { x: string; y: number }[];
  plan: number;
}) {
  const router = useRouter();
  const pathRef = useRef<SVGPathElement>(null);
  const [length, setLength] = useState(0);
  const [drawn, setDrawn] = useState(false);
  const yearly = period.mode === "year";
  const slots = yearly ? 12 : Number(period.to.slice(8, 10));

  const values = points.map((p) => p.y);
  const top = Math.max(plan * 1.1, ...values, 1);
  const bottom = Math.min(0, ...values);
  const step = niceStep(top - bottom);
  const yMax = Math.ceil(top / step) * step;
  const yMin = Math.floor(bottom / step) * step;
  const x = (i: number) => PAD.left + (slots <= 1 ? 0 : (i / (slots - 1)) * (W - PAD.left - PAD.right));
  const y = (v: number) => PAD.top + ((yMax - v) / (yMax - yMin || 1)) * (H - PAD.top - PAD.bottom);
  // From 0 at the period's start to each point.
  const d = points.length ? `M ${x(0)} ${y(0)} ` + points.map((p, i) => `L ${x(i)} ${y(p.y)}`).join(" ") : "";
  const dataKey = `${employeeId}|${period.from}|${period.to}|${values.join(",")}`;

  // The line grows from 0 to its last value whenever the data change.
  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const total = path.getTotalLength();
    setLength(total);
    setDrawn(false);
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true)));
    return () => cancelAnimationFrame(frame);
  }, [dataKey]);

  const last = points[points.length - 1]?.y ?? 0;
  const done = plan > 0 ? Math.round((last / plan) * 100) : null;
  const ticks: number[] = [];
  for (let v = yMin; v <= yMax + 1; v += step) ticks.push(v);
  const label = (i: number) => (yearly ? MONTH_NAMES[i].slice(0, 3) : String(i + 1));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Выполнение плана · {period.label}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Сотрудник"
            value={employeeId}
            onChange={(e) => {
              const params = new URLSearchParams({ p: period.mode, y: String(period.y), m: String(period.m), e: e.target.value });
              router.push(`/admin/reports/execution?${params}`);
            }}
            className="rounded-md border border-foreground/20 bg-background px-2 py-1.5 text-sm"
          >
            <option value="">— сотрудник —</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <PeriodPicker period={period} path="/admin/reports/execution" modes={["month", "year"]} extra={employeeId ? { e: employeeId } : {}} />
        </div>
      </div>

      {!employeeId ? (
        <p className="mt-6 text-sm text-foreground/50">Выберите сотрудника.</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-6 text-sm">
            <div>
              Прибыль: <span className="font-semibold tabular-nums">{formatRub(last)}</span>
            </div>
            <div>
              Минимальный план: <span className="font-semibold tabular-nums">{formatRub(plan)}</span>
              {plan === 0 && <span className="text-foreground/50"> (оклад не задан)</span>}
            </div>
            {done !== null && (
              <div className={done >= 100 ? "font-semibold text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"}>Выполнено {done}%</div>
            )}
          </div>
          <div className="mt-3 overflow-x-auto">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[640px]" role="img" aria-label="График выполнения плана">
              {ticks.map((v) => (
                <g key={v}>
                  <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} className="stroke-foreground/10" strokeWidth={1} />
                  <text x={PAD.left - 8} y={y(v) + 4} textAnchor="end" className="fill-foreground/50 text-[11px]">
                    {short(v)}
                  </text>
                </g>
              ))}
              {Array.from({ length: slots }, (_, i) => i)
                .filter((i) => yearly || i % Math.ceil(slots / 15) === 0 || i === slots - 1)
                .map((i) => (
                  <text key={i} x={x(i)} y={H - PAD.bottom + 18} textAnchor="middle" className="fill-foreground/50 text-[11px]">
                    {label(i)}
                  </text>
                ))}
              <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={H - PAD.bottom} className="stroke-foreground/30" />
              <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} className="stroke-foreground/30" />
              {plan > 0 && (
                <g>
                  <line x1={PAD.left} x2={W - PAD.right} y1={y(plan)} y2={y(plan)} stroke="#d97706" strokeWidth={1.5} strokeDasharray="7 5" />
                  <text x={W - PAD.right} y={y(plan) - 6} textAnchor="end" fill="#d97706" className="text-[11px]">
                    минимальный план
                  </text>
                </g>
              )}
              {d && (
                <path
                  key={dataKey}
                  ref={pathRef}
                  d={d}
                  fill="none"
                  stroke="#16a34a"
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  style={{
                    strokeDasharray: length || undefined,
                    strokeDashoffset: drawn ? 0 : length,
                    transition: drawn ? `stroke-dashoffset ${ANIMATION_MS}ms ease-out` : "none",
                  }}
                />
              )}
              {points.length > 0 && drawn && (
                <circle cx={x(points.length - 1)} cy={y(last)} r={4} fill="#16a34a" style={{ animation: `fadeIn 300ms ${ANIMATION_MS}ms both` }} />
              )}
            </svg>
          </div>
          <style>{"@keyframes fadeIn{from{opacity:0}to{opacity:1}}"}</style>
          <p className="mt-2 text-xs text-foreground/50">
            Прибыль — как в «Бонусах»: оплаченные и выданные продажи сотрудника минус себестоимость и его затраты, нарастающим итогом
            {yearly ? " по месяцам" : " по дням"}. План = оклад × 1,5 × 1,5{yearly ? " × 12" : ""}.
          </p>
        </>
      )}
    </div>
  );
}
