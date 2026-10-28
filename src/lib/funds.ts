import "server-only";
import { prisma } from "@/lib/prisma";
import { moneyRows, moscowDay, ndflOf, ndflRate } from "@/lib/finance";
import { ndflBaseUpTo } from "@/lib/ndfl-base";
import { monthDays, payrollOf } from "@/lib/payroll";
import { getGlonassMileage } from "@/lib/glonass";

// Финансы → Фонды: each month's money in (the statements) is set aside --
//  НДС 22% of the parts (sales' VAT less the suppliers'), НДФЛ (the year's
//  progressive scale), Зарплата (the payroll), Амортизация и документы ТС and
//  Ремонты (1 ₽ per km of the taxis, ГЛОНАСС), Лизинг (the vehicles' cards) --
//  and the rest is Свободный остаток. A payment request is paid from a fund
//  (PaymentRequest.fund) and only while the fund holds enough.

import { FUNDS, FUND_LABELS, type Fund } from "@/lib/fund-labels";

export { FUNDS, FUND_LABELS, type Fund };
/** ₽ per km of the taxis. */
const PER_KM = { DEPRECIATION: 1, REPAIRS: 1 };

export type MonthFunds = {
  month: string;
  income: number;
  allocations: Record<Fund, number>;
  /** How each was counted. */
  notes: Partial<Record<Fund, string>>;
  km: number | null;
};

const rub = (k: number) => `${Math.round(k / 100).toLocaleString("ru-RU")} ₽`;

/** What a month sets aside. */
export async function monthFunds(month: string): Promise<MonthFunds> {
  const { from, to } = monthDays(month);
  const rows = await moneyRows(moscowDay(from), moscowDay(to));
  const suppliers = new Set(
    (await prisma.company.findMany({ where: { type: "Поставщик", inn: { not: null } }, select: { inn: true } })).map((c) => c.inn!)
  );
  const income = rows.filter((r) => r.kind === "income").reduce((s, r) => s + r.amount, 0);
  // НДС of the parts: the orders' payments less the suppliers'.
  const salesVat = rows.filter((r) => r.kind === "income" && r.orderId).reduce((s, r) => s + r.vat, 0);
  const buyVat = rows.filter((r) => r.kind === "expense" && r.inn && suppliers.has(r.inn)).reduce((s, r) => s + r.vat, 0);
  const vat = salesVat - buyVat;

  const year = Number(month.slice(0, 4));
  const prevEnd = new Date(moscowDay(from).getTime() - 12 * 3600 * 1000).toLocaleDateString("sv-SE", { timeZone: "Europe/Moscow" });
  const [baseEnd, baseBefore] = await Promise.all([ndflBaseUpTo(year, to), ndflBaseUpTo(year, prevEnd)]);
  const ndfl = Math.max(0, ndflOf(Math.max(0, baseEnd)) - ndflOf(Math.max(0, baseBefore)));

  const salary = (await payrollOf(month)).reduce((s, l) => s + l.accrued, 0);
  let km: number | null = null;
  try {
    km = (await getGlonassMileage(moscowDay(from), new Date(moscowDay(to).getTime() + 24 * 3600 * 1000 - 1000))).reduce((s, v) => s + v.km, 0);
  } catch {
    km = null;
  }
  const leasing = (await prisma.vehicle.aggregate({ _sum: { leasingMonthly: true } }))._sum.leasingMonthly ?? 0;

  const allocations: Record<Fund, number> = {
    VAT: vat,
    NDFL: ndfl,
    SALARY: salary,
    DEPRECIATION: (km ?? 0) * PER_KM.DEPRECIATION * 100,
    LEASING: leasing,
    REPAIRS: (km ?? 0) * PER_KM.REPAIRS * 100,
    FREE: 0,
  };
  allocations.FREE = income - FUNDS.filter((f) => f !== "FREE").reduce((s, f) => s + allocations[f], 0);
  return {
    month,
    income,
    allocations,
    km,
    notes: {
      VAT: `НДС продаж запчастей ${rub(salesVat)} − НДС поставщиков ${rub(buyVat)}`,
      NDFL: `ставка ${ndflRate(Math.max(0, baseEnd))}% (база с начала года ${rub(Math.max(0, baseEnd))})`,
      SALARY: "по ведомости Финансы → Зарплата",
      DEPRECIATION: km === null ? "ГЛОНАСС не ответил — пробег неизвестен" : `${km.toLocaleString("ru-RU")} км × 1 ₽`,
      LEASING: "по карточкам ТС",
      REPAIRS: km === null ? "ГЛОНАСС не ответил — пробег неизвестен" : `${km.toLocaleString("ru-RU")} км × 1 ₽`,
      FREE: `поступления ${rub(income)} − остальные фонды`,
    },
  };
}

/** The first month with statements. */
async function firstMonth() {
  const first = await prisma.bankTransaction.findFirst({ orderBy: { date: "asc" }, select: { date: true } });
  return first ? first.date.toLocaleDateString("sv-SE", { timeZone: "Europe/Moscow" }).slice(0, 7) : null;
}

function nextMonth(month: string) {
  let [y, m] = month.split("-").map(Number);
  if (++m > 12) (m = 1), y++;
  return `${y}-${String(m).padStart(2, "0")}`;
}

export type FundMove = { date: string; fund: Fund; text: string; in: number; out: number; href?: string };

/** Paid requests charged to the funds, up to a day. */
async function paidRequests(until: Date) {
  return prisma.paymentRequest.findMany({
    where: { status: "Оплачено", paidAt: { lte: until } },
    select: { id: true, number: true, fund: true, amount: true, paidAt: true, purpose: true, company: { select: { name: true } } },
    orderBy: { paidAt: "asc" },
  });
}

/** Each fund's balance up to the end of a month: all its allocations less the requests paid from it. */
export async function fundBalances(untilMonth: string): Promise<Record<Fund, number>> {
  const balances = Object.fromEntries(FUNDS.map((f) => [f, 0])) as Record<Fund, number>;
  const start = await firstMonth();
  if (start) {
    for (let m = start; m <= untilMonth; m = nextMonth(m)) {
      const a = (await monthFunds(m)).allocations;
      for (const f of FUNDS) balances[f] += a[f];
    }
  }
  const end = new Date(moscowDay(monthDays(untilMonth).to).getTime() + 24 * 3600 * 1000 - 1);
  for (const r of await paidRequests(end)) balances[(FUNDS as readonly string[]).includes(r.fund) ? (r.fund as Fund) : "FREE"] -= r.amount;
  return balances;
}

/** The month's movements: the allocations (at the month's end) and the requests paid. */
export async function fundMoves(month: string, data: MonthFunds): Promise<FundMove[]> {
  const { from, to } = monthDays(month);
  const moves: FundMove[] = FUNDS.filter((f) => data.allocations[f] !== 0).map((f) => ({
    date: to,
    fund: f,
    text: `Начисление за месяц: ${data.notes[f] ?? ""}`,
    in: data.allocations[f] > 0 ? data.allocations[f] : 0,
    out: data.allocations[f] < 0 ? -data.allocations[f] : 0,
  }));
  const paid = await prisma.paymentRequest.findMany({
    where: { status: "Оплачено", paidAt: { gte: moscowDay(from), lt: new Date(moscowDay(to).getTime() + 24 * 3600 * 1000) } },
    select: { number: true, fund: true, amount: true, paidAt: true, purpose: true, company: { select: { name: true } } },
  });
  for (const r of paid) {
    moves.push({
      date: r.paidAt!.toLocaleDateString("sv-SE", { timeZone: "Europe/Moscow" }),
      fund: (FUNDS as readonly string[]).includes(r.fund) ? (r.fund as Fund) : "FREE",
      text: `Заявка № ${r.number}${r.company ? ` — ${r.company.name}` : ""}${r.purpose ? `: ${r.purpose}` : ""}`,
      in: 0,
      out: r.amount,
      href: "/admin/finance/payment-requests",
    });
  }
  return moves.sort((a, b) => a.date.localeCompare(b.date));
}

/** Whether the fund can pay this much now (the current month's balance). */
export async function fundCanPay(fund: string, amount: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const f = ((FUNDS as readonly string[]).includes(fund) ? fund : "FREE") as Fund;
  const month = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Moscow" }).slice(0, 7);
  const balance = (await fundBalances(month))[f];
  if (balance >= amount) return { ok: true };
  return { ok: false, error: `В фонде «${FUND_LABELS[f]}» ${rub(Math.max(0, balance))} — не хватает ${rub(amount - Math.max(0, balance))} для оплаты заявки` };
}
