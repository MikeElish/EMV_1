// Order numbers are date-scoped ("ДДММГГ/N"), day boundaries computed in
// Moscow time regardless of the server's own timezone (the VPS runs UTC).
const ORDER_NUMBER_TZ = "Europe/Moscow";
const MOSCOW_UTC_OFFSET = "+03:00"; // fixed offset -- Russia has not observed DST since 2014

function getMoscowDateParts(date: Date): { day: string; month: string; year: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ORDER_NUMBER_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value])) as {
    day: string;
    month: string;
    year: string;
  };
  return map;
}

/** "ДДММГГ" for the Moscow calendar day containing `date`. */
export function formatOrderDatePrefix(date: Date): string {
  const { day, month, year } = getMoscowDateParts(date);
  return `${day}${month}${year}`;
}

/** UTC [start, end) boundaries of the Moscow calendar day containing `date`. */
export function getMoscowDayRangeUtc(date: Date): { start: Date; end: Date } {
  const { day, month, year } = getMoscowDateParts(date);
  const start = new Date(`20${year}-${month}-${day}T00:00:00${MOSCOW_UTC_OFFSET}`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export function formatOrderNumber(date: Date, sequence: number): string {
  return `${formatOrderDatePrefix(date)}/${sequence}`;
}
