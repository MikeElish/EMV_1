"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { formatRub, rublesToKopecksRoundedUp } from "@/lib/money";
import type { Period } from "@/lib/period";
import type { TaxYear } from "@/lib/taxes";
import { saveTaxSettings } from "@/actions/admin/taxes";
import { PeriodPicker } from "@/components/admin/PeriodPicker";

const ru = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const inputClass = "mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-foreground/50";
const rubText = (k: number) => (k ? String(k / 100).replace(".", ",") : "");
const parseRub = (s: string) => {
  const n = parseFloat(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? rublesToKopecksRoundedUp(n) : 0;
};

export function TaxesView({ period, data, today }: { period: Period; data: TaxYear; today: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const due = data.payments.filter((p) => p.due <= today).reduce((s, p) => s + (p.amount ?? 0), 0);
  const total = data.payments.reduce((s, p) => s + (p.amount ?? 0), 0);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const r = await saveTaxSettings({
        patentCost: parseRub(String(form.get("patentCost") ?? "")),
        patentFrom: String(form.get("patentFrom") ?? ""),
        patentTo: String(form.get("patentTo") ?? ""),
        insuranceFixed: parseRub(String(form.get("insuranceFixed") ?? "")),
      });
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Налоги · {data.year}</h1>
        <PeriodPicker period={period} path="/admin/finance/taxes" modes={["year"]} />
      </div>
      <p className="mt-1 max-w-3xl text-xs text-foreground/50">
        ИП на ОСН (запчасти) + патент (такси) + работодатель. Суммы — черновой расчёт по выпискам банков и ведомости зарплаты; всё платится на ЕНП до
        28-го числа, если не указано иное.
      </p>

      <div className="mt-4 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-foreground/15 px-4 py-3">
          <div className="text-xs uppercase text-foreground/60">Начислено за год</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{formatRub(total)}</div>
        </div>
        <div className="rounded-lg border border-amber-500/40 bg-amber-400/10 px-4 py-3">
          <div className="text-xs uppercase text-amber-800 dark:text-amber-300">Срок уже наступил</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{formatRub(due)}</div>
        </div>
        <div className="rounded-lg border border-green-600/40 bg-green-600/10 px-4 py-3">
          <div className="text-xs uppercase text-green-800 dark:text-green-400">Уплачено на ЕНП</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{formatRub(data.paid)}</div>
        </div>
      </div>

      <h2 className="mt-8 text-base font-semibold">График уплаты</h2>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-foreground/10 text-left text-xs text-foreground/50">
              <th className="py-1.5 pr-3 font-normal">Срок</th>
              <th className="py-1.5 pr-3 font-normal">Налог / взнос</th>
              <th className="py-1.5 pr-3 font-normal">Период</th>
              <th className="py-1.5 pr-3 text-right font-normal">Сумма</th>
              <th className="py-1.5 font-normal">Примечание</th>
            </tr>
          </thead>
          <tbody>
            {data.payments.map((p) => (
              <tr key={p.key} className={`border-b border-foreground/10 align-top ${p.due <= today ? "" : "text-foreground/70"}`}>
                <td className={`whitespace-nowrap py-1.5 pr-3 ${p.due <= today ? "font-medium" : ""}`}>{ru(p.due)}</td>
                <td className="py-1.5 pr-3">{p.tax}</td>
                <td className="whitespace-nowrap py-1.5 pr-3">{p.period}</td>
                <td className="whitespace-nowrap py-1.5 pr-3 text-right tabular-nums">{p.amount === null ? "—" : formatRub(p.amount)}</td>
                <td className="py-1.5 text-xs text-foreground/60">{p.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={save} className="mt-8 max-w-3xl rounded-lg border border-foreground/10 p-4">
        <h2 className="text-sm font-semibold">Данные, которых нет в выписках</h2>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <label className="text-sm text-foreground/60">
            Стоимость патента, ₽
            <input name="patentCost" inputMode="decimal" defaultValue={rubText(data.settings.patentCost)} className={inputClass} />
          </label>
          <label className="text-sm text-foreground/60">
            Патент с
            <input name="patentFrom" type="date" defaultValue={data.settings.patentFrom ?? ""} className={inputClass} />
          </label>
          <label className="text-sm text-foreground/60">
            Патент по
            <input name="patentTo" type="date" defaultValue={data.settings.patentTo ?? ""} className={inputClass} />
          </label>
          <label className="text-sm text-foreground/60">
            Фикс. взносы ИП, ₽
            <input name="insuranceFixed" inputMode="decimal" defaultValue={rubText(data.settings.insuranceFixed)} className={inputClass} />
          </label>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button type="submit" disabled={pending} className="rounded-md bg-foreground px-4 py-1.5 text-sm font-medium text-background disabled:opacity-50">
            {pending ? "Сохраняем..." : "Сохранить"}
          </button>
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </form>
    </div>
  );
}
