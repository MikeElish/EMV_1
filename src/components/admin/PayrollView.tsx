"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatRub } from "@/lib/money";
import type { Period } from "@/lib/period";
import type { PayrollLine } from "@/lib/payroll";
import { savePayrollLine } from "@/actions/admin/payroll";
import { PeriodPicker } from "@/components/admin/PeriodPicker";

const cell = "w-28 rounded border border-foreground/20 bg-transparent px-1.5 py-0.5 text-right text-sm tabular-nums outline-none focus:border-foreground/50";
const rubText = (k: number | null) => (k ? String(k / 100).replace(".", ",") : "");
const parseRub = (s: string) => {
  const t = s.replace(/\s/g, "").replace(",", ".");
  if (!t) return 0;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
};

function MoneyCell({ value, onSave, title }: { value: number | null; onSave: (v: number) => Promise<string | null>; title: string }) {
  const [text, setText] = useState(rubText(value));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  function commit() {
    const v = parseRub(text);
    if (Number.isNaN(v)) return setError("число");
    if (v === (value ?? 0)) return;
    startTransition(async () => setError(await onSave(v)));
  }
  return (
    <div>
      <input
        aria-label={title}
        value={text}
        disabled={pending}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
        className={cell}
      />
      {error && <div className="text-xs text-red-600">{error}</div>}
    </div>
  );
}

export function PayrollView({ period, month, lines }: { period: Period; month: string; lines: PayrollLine[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const save = (userId: string, change: Parameters<typeof savePayrollLine>[2]) =>
    new Promise<string | null>((resolve) =>
      startTransition(async () => {
        const r = await savePayrollLine(month, userId, change);
        if (r.ok) router.refresh();
        resolve(r.ok ? null : r.error);
      })
    );
  const accrued = lines.reduce((s, l) => s + l.accrued, 0);
  const cash = lines.reduce((s, l) => s + l.cash, 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Зарплата · {period.label}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodPicker period={period} path="/admin/finance/payroll" modes={["month"]} />
          <a
            href={`/admin/finance/payroll/payslips?month=${month}`}
            target="_blank"
            rel="noopener"
            className="rounded-md border border-foreground/20 px-4 py-1.5 text-sm font-medium hover:bg-foreground/5"
          >
            Сформировать расчётки
          </a>
        </div>
      </div>
      <p className="mt-1 max-w-3xl text-xs text-foreground/50">
        Строки заполняются по карточкам сотрудников (CRM → Пользователи: должность, оклад, %): план = оклад × 1,5 × 1,5; до плана — оклад, с прибыли
        сверх плана — % из карточки. Водителям — % от выработки. «Начислено» можно исправить — тогда строка не пересчитывается.
      </p>

      {lines.length === 0 ? (
        <p className="mt-6 text-sm text-foreground/50">
          Ни у одного сотрудника не задан оклад или %. Укажите их в{" "}
          <Link href="/admin/crm/users" className="underline underline-offset-2">
            CRM → Пользователи
          </Link>
          .
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className={`w-full min-w-[860px] text-sm ${pending ? "opacity-70" : ""}`}>
            <thead>
              <tr className="border-b border-foreground/10 text-left text-xs text-foreground/50">
                <th className="py-1.5 pr-3 font-normal">ФИО</th>
                <th className="py-1.5 pr-3 font-normal">Должность</th>
                <th className="py-1.5 pr-3 font-normal">Расчёт</th>
                <th className="py-1.5 pr-3 text-right font-normal">Начислено</th>
                <th className="py-1.5 text-right font-normal">Наличные</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.userId} className="border-b border-foreground/10 align-top">
                  <td className="py-2 pr-3 font-medium">{l.name}</td>
                  <td className="py-2 pr-3">
                    <input
                      aria-label="Должность"
                      defaultValue={l.position}
                      onBlur={(e) => e.target.value !== l.position && void save(l.userId, { position: e.target.value })}
                      className="w-40 rounded border border-foreground/20 bg-transparent px-1.5 py-0.5 text-sm outline-none focus:border-foreground/50"
                    />
                  </td>
                  <td className="py-2 pr-3 text-xs text-foreground/70">
                    {l.calculation}
                    {l.role === "DRIVER" && (
                      <div className="mt-1 flex items-center gap-2">
                        <span>Выработка, ₽:</span>
                        <MoneyCell value={l.output} title="Выработка" onSave={(v) => save(l.userId, { output: v })} />
                      </div>
                    )}
                    {l.manual && (
                      <button type="button" onClick={() => void save(l.userId, { reset: true })} className="mt-1 block underline underline-offset-2">
                        пересчитать по правилу
                      </button>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <div className="flex justify-end">
                      <MoneyCell key={`a${l.accrued}`} value={l.accrued} title="Начислено" onSave={(v) => save(l.userId, { accrued: v })} />
                    </div>
                  </td>
                  <td className="py-2 text-right">
                    <div className="flex justify-end">
                      <MoneyCell key={`c${l.cash}`} value={l.cash} title="Наличные" onSave={(v) => save(l.userId, { cash: v })} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td colSpan={3} className="pt-3 pr-3 text-right">
                  ИТОГО
                </td>
                <td className="pt-3 pr-3 text-right tabular-nums">{formatRub(accrued)}</td>
                <td className="pt-3 text-right tabular-nums">{formatRub(cash)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
