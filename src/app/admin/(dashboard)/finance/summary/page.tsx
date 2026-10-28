import { requireSection } from "@/lib/access-server";
import { parsePeriod } from "@/lib/period";
import { moneyRows, moscowDay, ndflOf, ndflRate, totalsOf } from "@/lib/finance";
import { monthsOf, payrollTotal } from "@/lib/payroll";
import { FinanceSummaryView } from "@/components/admin/FinanceSummaryView";
import { ndflBaseUpTo } from "@/lib/ndfl-base";

export default async function FinanceSummaryPage({ searchParams }: PageProps<"/admin/finance/summary">) {
  await requireSection("finance.summary");
  const period = parsePeriod(await searchParams);
  const rows = await moneyRows(moscowDay(period.from), moscowDay(period.to));
  const t = totalsOf(rows);
  const salary = await payrollTotal(monthsOf(period.from, period.to));

  // НДФЛ of the period: the year's tax at its end less that before it (the scale is progressive).
  const year = Number(period.to.slice(0, 4));
  const dayBefore = new Date(moscowDay(period.from).getTime() - 12 * 3600 * 1000).toLocaleDateString("sv-SE", { timeZone: "Europe/Moscow" });
  const [baseEnd, baseBefore] = await Promise.all([ndflBaseUpTo(year, period.to), ndflBaseUpTo(year, dayBefore)]);
  const ndfl = Math.max(0, ndflOf(Math.max(0, baseEnd)) - ndflOf(Math.max(0, baseBefore)));

  const total = t.income - t.expense;
  const totalVat = t.incomeVat - t.expenseVat;
  return (
    <FinanceSummaryView
      period={period}
      tiles={{
        income: t.income,
        incomeVat: t.incomeVat,
        expense: t.expense,
        expenseVat: t.expenseVat,
        total,
        totalVat,
        salary,
        ndfl,
        ndflRate: ndflRate(Math.max(0, baseEnd)),
        rest: total - Math.max(0, totalVat) - salary - ndfl,
        taxPaid: t.taxPaid,
      }}
      rows={rows
        .filter((r) => r.kind !== "own")
        .map((r) => ({
          id: r.id,
          date: r.date.toISOString(),
          kind: r.kind,
          amount: r.amount,
          vat: r.vat,
          counterparty: r.counterparty,
          purpose: r.purpose,
        }))}
    />
  );
}
