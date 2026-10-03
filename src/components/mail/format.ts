// Fixed zone: the list is rendered on the server and then hydrated in the
// browser -- both must print the same time. The company works on Moscow time.
const TZ = "Europe/Moscow";

const dayKey = (d: Date) => d.toLocaleDateString("ru-RU", { timeZone: TZ });
const yearOf = (d: Date) => d.toLocaleDateString("ru-RU", { timeZone: TZ, year: "numeric" });

/** Like Yandex: time for today, "3 окт." this year, full date otherwise. */
export function formatMailDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  if (dayKey(d) === dayKey(now)) {
    return d.toLocaleTimeString("ru-RU", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
  }
  if (yearOf(d) === yearOf(now)) {
    return d.toLocaleDateString("ru-RU", { timeZone: TZ, day: "numeric", month: "short" });
  }
  return d.toLocaleDateString("ru-RU", { timeZone: TZ });
}

export function formatFullDate(iso: string | null): string {
  return iso
    ? new Date(iso).toLocaleString("ru-RU", { timeZone: TZ, dateStyle: "long", timeStyle: "short" })
    : "";
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}
