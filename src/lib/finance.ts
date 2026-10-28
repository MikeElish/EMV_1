import "server-only";
import { prisma } from "@/lib/prisma";

// Финансы: the money of a period from the bank statements (Банки). An
// incoming payment is ПОСТУПЛЕНИЕ, an outgoing one ЗАТРАТЫ -- except transfers
// between the owner's own accounts (his ИНН) and payments to the Treasury
// (ЕНП: taxes), which are neither. The VAT is the one named in the purpose
// («в т.ч. НДС 22% 1234.56»).

/** Казначейство России (ФНС России): the ЕНП account. */
export const TREASURY_INN = "7727406020";
const DAY = 24 * 60 * 60 * 1000;

export type TxKind = "income" | "expense" | "own" | "tax";

/** Taxi money (Яндекс): the patent's, not ОСН's -- no VAT, not in the НДФЛ base. */
export const isPatentIncome = (tx: { incoming: boolean; counterpartyName: string | null }) =>
  tx.incoming && /такси|яндекс|yandex/i.test(tx.counterpartyName ?? "");

/** «в т.ч. НДС 22% 5193.44» → 519344 kopecks; 0 without VAT. */
export function vatOf(purpose: string | null): number {
  const p = purpose ?? "";
  if (/без\s*(налога\s*\(?)?\s*НДС|НДС\s*не\s*облага/i.test(p)) return 0;
  const m = p.match(/НДС[^0-9]{0,12}(?:\d{1,2}(?:[.,]\d+)?\s*%\s*)?[^0-9]{0,15}?(\d[\d\s]*(?:[.,-]\d{1,2})?)/i);
  if (!m) return 0;
  const n = parseFloat(m[1].replace(/\s/g, "").replace(/[,-]/, "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export async function ownInn() {
  const own = await prisma.company.findFirst({ where: { isOwn: true }, select: { inn: true } });
  return own?.inn ?? "222330730938";
}

export function kindOf(tx: { incoming: boolean; counterpartyInn: string | null; counterpartyName: string | null }, own: string): TxKind {
  if (tx.counterpartyInn === own) return "own";
  if (!tx.incoming && (tx.counterpartyInn === TREASURY_INN || /казначейств|^УФК/i.test(tx.counterpartyName ?? ""))) return "tax";
  return tx.incoming ? "income" : "expense";
}

export type MoneyRow = {
  id: string;
  date: Date;
  kind: TxKind;
  /** Taxi income under the patent. */
  patent: boolean;
  amount: number;
  vat: number;
  counterparty: string | null;
  inn: string | null;
  purpose: string | null;
  orderId: string | null;
  bankAccount: string;
};

/** The statements' payments of [from, to] (Moscow days, inclusive). */
export async function moneyRows(from: Date, to: Date): Promise<MoneyRow[]> {
  const own = await ownInn();
  const rows = await prisma.bankTransaction.findMany({
    where: { date: { gte: from, lt: new Date(to.getTime() + DAY) } },
    orderBy: { date: "asc" },
    include: { bankAccount: { select: { name: true } } },
  });
  return rows.map((t) => ({
    id: t.id,
    date: t.date,
    kind: kindOf(t, own),
    patent: isPatentIncome(t),
    amount: t.amount,
    vat: vatOf(t.purpose),
    counterparty: t.counterpartyName,
    inn: t.counterpartyInn,
    purpose: t.purpose,
    orderId: t.orderId,
    bankAccount: t.bankAccount.name,
  }));
}

export type MoneyTotals = { income: number; incomeVat: number; patentIncome: number; expense: number; expenseVat: number; taxPaid: number };

export function totalsOf(rows: MoneyRow[]): MoneyTotals {
  const t: MoneyTotals = { income: 0, incomeVat: 0, patentIncome: 0, expense: 0, expenseVat: 0, taxPaid: 0 };
  for (const r of rows) {
    if (r.kind === "income") (t.income += r.amount), (t.incomeVat += r.vat), (t.patentIncome += r.patent ? r.amount : 0);
    else if (r.kind === "expense") (t.expense += r.amount), (t.expenseVat += r.vat);
    else if (r.kind === "tax") t.taxPaid += r.amount;
  }
  return t;
}

// НДФЛ of an ИП on ОСН since 2025 (ст. 224 НК): progressive on the year's
// income less expenses.
export const NDFL_SCALE: [limit: number, rate: number][] = [
  [2_400_000_00, 13],
  [5_000_000_00, 15],
  [20_000_000_00, 18],
  [50_000_000_00, 20],
  [Infinity, 22],
];

/** НДФЛ of a year's base (kopecks). */
export function ndflOf(base: number): number {
  let tax = 0;
  let lower = 0;
  for (const [limit, rate] of NDFL_SCALE) {
    if (base <= lower) break;
    tax += ((Math.min(base, limit) - lower) * rate) / 100;
    lower = limit;
  }
  return Math.round(tax);
}

/** The rate the year's base has reached. */
export function ndflRate(base: number): number {
  return (NDFL_SCALE.find(([limit]) => base <= limit) ?? NDFL_SCALE[NDFL_SCALE.length - 1])[1];
}

/** Moscow midnight of a "YYYY-MM-DD". */
export const moscowDay = (iso: string) => new Date(`${iso}T00:00:00+03:00`);
export const isoDay = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Moscow" });
