import "server-only";
import { prisma } from "@/lib/prisma";
import { moneyRows, moscowDay, ndflOf, totalsOf } from "@/lib/finance";
import { ndflBaseUpTo } from "@/lib/ndfl-base";
import { payrollOf } from "@/lib/payroll";

// Финансы → Налоги: ИП Елишев М.В. -- ОСН (запчасти) + ПСН (такси) + работодатель.
// Amounts from the bank statements and the payroll; all due on the ЕНП by
// the 28th unless said otherwise. A draft to be checked by the owner.

/** МРОТ 2026, kopecks: the employees' contributions are 30% up to 1.5 МРОТ, 15% above (МСП). */
const MROT = 27_093_00;
const PATENT_INCOME_RATE = 6;

export type TaxPayment = {
  key: string;
  tax: string;
  period: string;
  /** "YYYY-MM-DD". */
  due: string;
  amount: number | null;
  note?: string;
};

export type TaxYear = {
  year: number;
  payments: TaxPayment[];
  /** ЕНП paid in the year (statements). */
  paid: number;
  settings: { patentCost: number; patentFrom: string | null; patentTo: string | null; insuranceFixed: number };
};

const iso = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Moscow" });
const pad = (n: number) => String(n).padStart(2, "0");
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const quarterDays = (y: number, q: number) => ({ from: `${y}-${pad((q - 1) * 3 + 1)}-01`, to: `${y}-${pad(q * 3)}-${lastDay(y, q * 3)}` });
/** The 28th of the month after `month` months from (y, m). */
function the28th(y: number, m: number, after: number) {
  const t = (m - 1 + after) % 12;
  const ty = y + Math.floor((m - 1 + after) / 12);
  return `${ty}-${pad(t + 1)}-28`;
}

export async function taxYear(year: number): Promise<TaxYear> {
  const settingsRow = await prisma.taxSettings.findUnique({ where: { id: 1 } });
  const settings = {
    patentCost: settingsRow?.patentCost ?? 0,
    patentFrom: settingsRow?.patentFrom ? iso(settingsRow.patentFrom) : null,
    patentTo: settingsRow?.patentTo ? iso(settingsRow.patentTo) : null,
    insuranceFixed: settingsRow?.insuranceFixed ?? 57_390_00,
  };
  const payments: TaxPayment[] = [];
  const today = iso(new Date());

  // НДС: the quarter's VAT of the sales less that of the purchases, a third by the 28th of each of the next 3 months.
  for (let q = 1; q <= 4; q++) {
    const { from, to } = quarterDays(year, q);
    if (from > today) break;
    const t = totalsOf(await moneyRows(moscowDay(from), moscowDay(to)));
    const vat = Math.max(0, t.incomeVat - t.expenseVat);
    for (let i = 1; i <= 3; i++) {
      payments.push({
        key: `vat-${q}-${i}`,
        tax: "НДС",
        period: `${q} кв. ${year}, ${i}/3`,
        due: the28th(year, q * 3, i),
        amount: Math.round(vat / 3),
        ...(i === 1 ? { note: `декларация до 25.${pad(((q * 3) % 12) + 1)}; НДС продаж ${(t.incomeVat / 100).toFixed(0)} ₽ − покупок ${(t.expenseVat / 100).toFixed(0)} ₽ (по выпискам)` } : {}),
      });
    }
  }

  // НДФЛ ИП (ОСН): advances for the quarter, half-year and 9 months; the year by 15 July.
  let before = 0;
  for (const [q, due] of [[1, `${year}-04-28`], [2, `${year}-07-28`], [3, `${year}-10-28`]] as const) {
    const { to } = quarterDays(year, q);
    if (quarterDays(year, q).from > today) break;
    const tax = ndflOf(Math.max(0, await ndflBaseUpTo(year, to)));
    payments.push({ key: `ndfl-${q}`, tax: "НДФЛ ИП (ОСН), аванс", period: ["", "1 кв.", "полугодие", "9 месяцев"][q] + ` ${year}`, due, amount: Math.max(0, tax - before) });
    before = tax;
  }
  const yearBase = Math.max(0, await ndflBaseUpTo(year, `${year}-12-31`));
  payments.push({
    key: "ndfl-year",
    tax: "НДФЛ ИП (ОСН), за год",
    period: `${year}`,
    due: `${year + 1}-07-15`,
    amount: Math.max(0, ndflOf(yearBase) - before),
    note: `3-НДФЛ до 30.04.${year + 1}; база ${(yearBase / 100).toFixed(0)} ₽ (доходы без такси − расходы − зарплата)`,
  });

  // Взносы ИП за себя: fixed by 28 December; 1% of the income over 300 000 ₽ by 1 July.
  payments.push({ key: "ins-fixed", tax: "Страховые взносы ИП (фиксированные)", period: `${year}`, due: `${year}-12-28`, amount: settings.insuranceFixed, note: "уменьшают налог по патенту" });
  const patentIncome = settings.patentCost ? Math.round((settings.patentCost * 100) / PATENT_INCOME_RATE) : 0;
  const over = Math.max(0, yearBase + patentIncome - 300_000_00);
  payments.push({
    key: "ins-1pct",
    tax: "Страховые взносы ИП 1% свыше 300 000 ₽",
    period: `${year}`,
    due: `${year + 1}-07-01`,
    amount: Math.round(over / 100),
    note: patentIncome ? `доход ОСН + потенциальный доход патента ${(patentIncome / 100).toFixed(0)} ₽` : "без патента: укажите его стоимость",
  });

  // Патент (такси): up to 6 months -- all by its end; longer -- 1/3 in 90 days, 2/3 by its end.
  if (settings.patentCost && settings.patentFrom && settings.patentTo) {
    const start = moscowDay(settings.patentFrom);
    const end = moscowDay(settings.patentTo);
    const months = (end.getTime() - start.getTime()) / (30.4 * 24 * 3600 * 1000);
    if (months <= 6) payments.push({ key: "psn", tax: "Патент (такси)", period: `${settings.patentFrom} — ${settings.patentTo}`, due: settings.patentTo, amount: settings.patentCost });
    else {
      payments.push({ key: "psn-1", tax: "Патент (такси), 1/3", period: `${settings.patentFrom} — ${settings.patentTo}`, due: iso(new Date(start.getTime() + 90 * 24 * 3600 * 1000)), amount: Math.round(settings.patentCost / 3) });
      payments.push({ key: "psn-2", tax: "Патент (такси), 2/3", period: `${settings.patentFrom} — ${settings.patentTo}`, due: settings.patentTo, amount: settings.patentCost - Math.round(settings.patentCost / 3) });
    }
  } else payments.push({ key: "psn", tax: "Патент (такси)", period: `${year}`, due: `${year}-12-31`, amount: null, note: "укажите стоимость и срок патента ниже" });

  // За сотрудников: НДФЛ 13% and contributions of each month's payroll, by the 28th of the next month.
  for (let m = 1; m <= 12; m++) {
    const month = `${year}-${pad(m)}`;
    if (`${month}-01` > today) break;
    const lines = (await payrollOf(month)).filter((l) => l.accrued > 0);
    if (!lines.length) continue;
    const accrued = lines.reduce((s, l) => s + l.accrued, 0);
    const limit = Math.round(MROT * 1.5);
    const contributions = lines.reduce((s, l) => s + Math.round(Math.min(l.accrued, limit) * 0.3 + Math.max(0, l.accrued - limit) * 0.15), 0);
    payments.push({ key: `pit-${m}`, tax: "НДФЛ за сотрудников 13%", period: month, due: the28th(year, m, 1), amount: Math.round(accrued * 0.13), note: "уведомление до 25-го" });
    payments.push({ key: `contrib-${m}`, tax: "Страховые взносы за сотрудников", period: month, due: the28th(year, m, 1), amount: contributions, note: "30% до 1,5 МРОТ, 15% свыше (МСП)" });
  }

  payments.push({ key: "transport", tax: "Транспортный налог", period: `${year}`, due: `${year + 1}-12-01`, amount: null, note: "по уведомлению ФНС (как физлицо)" });

  payments.sort((a, b) => a.due.localeCompare(b.due) || a.tax.localeCompare(b.tax, "ru"));
  const paid = totalsOf(await moneyRows(moscowDay(`${year}-01-01`), moscowDay(`${year}-12-31`))).taxPaid;
  return { year, payments, paid, settings };
}
