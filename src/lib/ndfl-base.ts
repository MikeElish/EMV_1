import "server-only";
import { moneyRows, moscowDay, totalsOf } from "@/lib/finance";
import { monthsOf, payrollTotal } from "@/lib/payroll";

/** The year's base for НДФЛ (ОСН) up to a day: income (not the patent's) less expenses, VAT off, less payroll. */
export async function ndflBaseUpTo(year: number, until: string) {
  const from = `${year}-01-01`;
  if (until < from) return 0;
  const t = totalsOf(await moneyRows(moscowDay(from), moscowDay(until)));
  return t.income - t.patentIncome - t.incomeVat - (t.expense - t.expenseVat) - (await payrollTotal(monthsOf(from, until)));
}
