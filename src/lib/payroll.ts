import "server-only";
import { prisma } from "@/lib/prisma";
import { salaryReport } from "@/lib/salary-report";

// Финансы → Зарплата. An employee with «Оклад» O and «% от прибыли» p:
//  - the plan is the profit that pays O after taxes and overheads:
//    O × 1.5 (taxes: НДС + НДФЛ) × 1.5 (overheads) = 2.25 O;
//  - up to the plan -- O; the profit above it adds p % of it.
// The profit is that of Отчёты → Бонусы (sales − cost of sales − costs, VAT
// not taken off). A driver gets p % of his «выработка» of the month, typed in.

export const PLAN_FACTOR = 1.5 * 1.5;

export type PayrollLine = {
  userId: string;
  name: string;
  role: string;
  position: string;
  calculation: string;
  accrued: number;
  cash: number;
  output: number | null;
  manual: boolean;
  saved: boolean;
  /** The month's profit and the plan (not for drivers). */
  profit: number | null;
  plan: number | null;
};

const rub = (k: number) => `${(k / 100).toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽`;
const pct = (p: number) => `${String(p).replace(".", ",")}%`;

/** "2026-10" → its first and last day. */
export function monthDays(month: string) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

/** The plan of an Оклад: the profit that covers it. */
export const planOf = (salary: number) => Math.round(salary * PLAN_FACTOR);

/** Accrued by the rule: Оклад up to the plan, p % of the profit above it. */
export function accruedOf(salary: number, percent: number, profit: number) {
  const plan = planOf(salary);
  return salary + Math.max(0, Math.round(((profit - plan) * percent) / 100));
}

async function computed(user: { id: string; role: string; salary: number | null; salaryPercent: number | null }, month: string, output: number | null) {
  const salary = user.salary ?? 0;
  const percent = user.salaryPercent ?? 0;
  if (user.role === "DRIVER") {
    const accrued = Math.round(((output ?? 0) * percent) / 100);
    return {
      accrued,
      calculation: output ? `${pct(percent)} от выработки ${rub(output)}` : `${pct(percent)} от выработки — укажите выработку`,
      profit: null,
      plan: null,
    };
  }
  const { from, to } = monthDays(month);
  const { profit } = await salaryReport(user.id, from, to);
  const plan = planOf(salary);
  const accrued = accruedOf(salary, percent, profit);
  const parts = [`Оклад ${rub(salary)}`];
  if (percent) {
    parts.push(
      profit > plan
        ? `+ ${pct(percent)} × (прибыль ${rub(profit)} − план ${rub(plan)})`
        : `прибыль ${rub(profit)} не выше плана ${rub(plan)}`
    );
  }
  return { accrued, calculation: parts.join(" "), profit, plan };
}

/** The month's lines: the kept ones, and the rule for everyone with an Оклад or a %. */
export async function payrollOf(month: string): Promise<PayrollLine[]> {
  const [staff, kept] = await Promise.all([
    prisma.user.findMany({
      where: { role: { not: "CUSTOMER" }, OR: [{ salary: { gt: 0 } }, { salaryPercent: { gt: 0 } }, { payrollRows: { some: { month } } }] },
      select: { id: true, role: true, lastName: true, firstName: true, patronymic: true, login: true, salary: true, salaryPercent: true, position: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.payrollRow.findMany({ where: { month } }),
  ]);
  const keptOf = new Map(kept.map((r) => [r.userId, r]));
  const lines: PayrollLine[] = [];
  for (const u of staff) {
    const row = keptOf.get(u.id);
    const auto = await computed(u, month, row?.output ?? null);
    const manual = !!row?.manual;
    lines.push({
      userId: u.id,
      name: [u.lastName, u.firstName, u.patronymic].filter(Boolean).join(" ") || u.login,
      role: u.role,
      position: row?.position ?? u.position ?? "",
      calculation: manual ? row!.calculation : auto.calculation,
      accrued: manual ? row!.accrued : auto.accrued,
      cash: row?.cash ?? 0,
      output: row?.output ?? null,
      manual,
      saved: !!row,
      profit: auto.profit,
      plan: auto.plan,
    });
  }
  return lines;
}

/** «Начислено» of these months in all. */
export async function payrollTotal(months: string[]) {
  let total = 0;
  for (const m of months) for (const l of await payrollOf(m)) total += l.accrued;
  return total;
}

/** The months ("YYYY-MM") a period touches. */
export function monthsOf(from: string, to: string) {
  const out: string[] = [];
  let [y, m] = from.slice(0, 7).split("-").map(Number);
  const [ty, tm] = to.slice(0, 7).split("-").map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    if (++m > 12) (m = 1), y++;
  }
  return out;
}
