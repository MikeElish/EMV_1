// A report's period from the address: ?p=month&y=2026&m=10, ?p=quarter&y=2026&q=4,
// ?p=year&y=2026 or ?p=dates&from=…&to=… (Moscow days). This month by default.

export type PeriodMode = "dates" | "month" | "quarter" | "year";
export type Period = { mode: PeriodMode; from: string; to: string; y: number; m: number; q: number; label: string };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const pad = (n: number) => String(n).padStart(2, "0");
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const ru = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

export function parsePeriod(sp: Record<string, string | string[] | undefined>, allowed: PeriodMode[] = ["dates", "month", "quarter", "year"]): Period {
  const pick = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Moscow" });
  const y = Number(pick("y")) || Number(today.slice(0, 4));
  const m = Math.min(12, Math.max(1, Number(pick("m")) || Number(today.slice(5, 7))));
  const q = Math.min(4, Math.max(1, Number(pick("q")) || Math.ceil(Number(today.slice(5, 7)) / 3)));
  const wanted = pick("p") as PeriodMode;
  const mode: PeriodMode = allowed.includes(wanted) ? wanted : allowed.includes("month") ? "month" : allowed[0];
  if (mode === "year") return { mode, y, m, q, from: `${y}-01-01`, to: `${y}-12-31`, label: `${y} год` };
  if (mode === "quarter") {
    const first = (q - 1) * 3 + 1;
    return { mode, y, m, q, from: `${y}-${pad(first)}-01`, to: `${y}-${pad(first + 2)}-${lastDay(y, first + 2)}`, label: `${q} квартал ${y}` };
  }
  if (mode === "dates") {
    const from = DAY.test(pick("from")) ? pick("from") : `${today.slice(0, 8)}01`;
    const to = DAY.test(pick("to")) && pick("to") >= from ? pick("to") : today;
    return { mode, y, m, q, from, to, label: `${ru(from)} — ${ru(to)}` };
  }
  return { mode, y, m, q, from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${lastDay(y, m)}`, label: `${MONTHS[m - 1]} ${y}` };
}

export const MONTH_NAMES = MONTHS;
