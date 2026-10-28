"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatRub } from "@/lib/money";
import type { SalaryReport } from "@/lib/salary-report";

const inputClass = "rounded-md border border-foreground/20 bg-background px-2 py-1.5 text-sm";

function Tile({ label, amount, className, strong = false }: { label: string; amount: number; className: string; strong?: boolean }) {
  return (
    <div className={`rounded-lg border px-4 py-3 ${className}`}>
      <div className="text-xs uppercase tracking-wide opacity-80">{label}</div>
      <div className={`mt-1 whitespace-nowrap tabular-nums ${strong ? "text-2xl font-bold" : "text-xl font-semibold"}`}>{formatRub(amount)}</div>
    </div>
  );
}

export function SalaryReportView({
  employees,
  employeeId,
  from,
  to,
  report,
}: {
  employees: { id: string; name: string }[];
  employeeId: string;
  from: string;
  to: string;
  report: SalaryReport | null;
}) {
  const router = useRouter();

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams({ e: String(form.get("e") ?? ""), from: String(form.get("from")), to: String(form.get("to")) });
    router.push(`/admin/reports/bonuses?${params}`);
  }

  return (
    <div>
      <form onSubmit={apply} className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-foreground/60">
          Сотрудник
          <select name="e" defaultValue={employeeId} className={`mt-1 block min-w-56 ${inputClass}`}>
            <option value="">— выберите —</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-foreground/60">
          С
          <input name="from" type="date" defaultValue={from} className={`mt-1 block ${inputClass}`} />
        </label>
        <label className="text-sm text-foreground/60">
          По
          <input name="to" type="date" defaultValue={to} className={`mt-1 block ${inputClass}`} />
        </label>
        <button type="submit" className="rounded-md bg-foreground px-4 py-1.5 text-sm font-medium text-background hover:opacity-90">
          Показать
        </button>
      </form>

      {!report ? (
        <p className="mt-6 text-sm text-foreground/50">Выберите сотрудника и период.</p>
      ) : (
        <>
          <div className="mt-6 grid max-w-md grid-cols-1 gap-3">
            <Tile label="Продажи" amount={report.sales} className="border-lime-500/40 bg-lime-400/15 text-lime-800 dark:text-lime-300" />
            <Tile label="Себестоимость" amount={report.costOfSales} className="border-yellow-500/40 bg-yellow-300/20 text-yellow-800 dark:text-yellow-300" />
            <Tile label="Затраты" amount={report.costs} className="border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400" />
            <Tile label="Бонус к выплате" amount={report.payout} strong className="border-green-700/50 bg-green-600/15 text-green-800 dark:text-green-400" />
          </div>
          <p className="mt-2 text-xs text-foreground/50">
            {report.percent === null
              ? "У сотрудника не задан «% от прибыли» (CRM → Пользователи → карточка) — «К выплате» не считается."
              : `Бонус = ${String(report.percent).replace(".", ",")}% от прибыли ${formatRub(report.profit)} (продажи − себестоимость − затраты) сверх плана ${formatRub(report.plan)} (оклад × 1,5 × 1,5). Оклад начисляется в Финансы → Зарплата.`}
          </p>

          <h2 className="mt-8 text-base font-semibold">Деталировка</h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-foreground/10 text-left text-xs text-foreground/50">
                  <th className="py-2 pr-4 font-normal">Документ</th>
                  <th className="py-2 pr-4 text-right font-normal" title="Продажа минус себестоимость">
                    Доход
                  </th>
                  <th className="py-2 pr-4 text-right font-normal">Затраты</th>
                  <th className="py-2 text-right font-normal">ВСЕГО</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-foreground/40">
                      За период нет оплаченных и выданных продаж и затрат сотрудника.
                    </td>
                  </tr>
                ) : (
                  report.rows.map((r) => (
                    <tr key={r.key} className="border-b border-foreground/10 align-top">
                      <td className="py-2 pr-4">
                        {r.href ? (
                          <Link href={r.href} className="hover:underline">
                            {r.document}
                          </Link>
                        ) : (
                          r.document
                        )}
                        {r.note && <div className="text-xs text-amber-700 dark:text-amber-500">{r.note}</div>}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-4 text-right tabular-nums">{r.income ? formatRub(r.income) : ""}</td>
                      <td className="whitespace-nowrap py-2 pr-4 text-right tabular-nums text-red-700 dark:text-red-400">{r.costs ? formatRub(r.costs) : ""}</td>
                      <td className="whitespace-nowrap py-2 text-right tabular-nums">{formatRub(r.total)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="pt-3 pr-4 text-right font-semibold">
                    ИТОГО
                  </td>
                  <td className="whitespace-nowrap pt-3 text-right font-bold tabular-nums">{formatRub(report.profit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
