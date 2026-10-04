"use client";

import { FitWidth } from "@/components/FitWidth";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getDispatchData, type DispatchResult } from "@/actions/admin/dispatch";
import type { FleetDriver, FleetDriverStatus } from "@/lib/yandex-fleet-data";

const POLL_MS = 30 * 1000;

const STATUS: Record<FleetDriverStatus, { label: string; color: string; group: "free" | "order" | "busy" | "offline" }> = {
  free: { label: "Свободен", color: "#16a34a", group: "free" },
  in_order_free: { label: "На заказе", color: "#2563eb", group: "order" },
  in_order_busy: { label: "На заказе", color: "#2563eb", group: "order" },
  busy: { label: "Занят", color: "#d97706", group: "busy" },
  offline: { label: "Не на линии", color: "#9ca3af", group: "offline" },
};

const WORK_STATUS: Record<string, string> = {
  working: "Работает",
  not_working: "Не работает",
  fired: "Уволен",
};

const FILTERS = [
  { id: "all", label: "Все" },
  { id: "online", label: "На линии" },
  { id: "free", label: "Свободны" },
  { id: "order", label: "На заказе" },
  { id: "offline", label: "Не на линии" },
] as const;
type FilterId = (typeof FILTERS)[number]["id"];

const TZ = "Europe/Moscow";
const rub = (n: number) => n.toLocaleString("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 2 });

function since(iso: string | null, now: number) {
  if (!iso) return "";
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч ${minutes % 60} мин`;
  return new Date(iso).toLocaleDateString("ru-RU", { timeZone: TZ });
}

function matches(d: FleetDriver, filter: FilterId) {
  const group = STATUS[d.status].group;
  if (filter === "all") return true;
  if (filter === "online") return group !== "offline";
  return group === filter;
}

export function DispatchBoard({ initial }: { initial: DispatchResult }) {
  const [data, setData] = useState(initial);
  const [pollError, setPollError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterId>("all");
  const [search, setSearch] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const next = await getDispatchData();
    setRefreshing(false);
    setNow(Date.now());
    setPollError(next.ok ? null : next.error);
    setData((prev) => (next.ok || !prev.ok ? next : prev));
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const drivers = useMemo(() => (data.ok ? data.drivers : []), [data]);
  const counts = useMemo(() => {
    const c = { all: drivers.length, online: 0, free: 0, order: 0, offline: 0 };
    for (const d of drivers) {
      const g = STATUS[d.status].group;
      if (g !== "offline") c.online++;
      if (g === "free") c.free++;
      if (g === "order") c.order++;
      if (g === "offline") c.offline++;
    }
    return c;
  }, [drivers]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return drivers
      .filter((d) => matches(d, filter))
      .filter(
        (d) =>
          !q ||
          d.name.toLowerCase().includes(q) ||
          d.phones.some((p) => p.includes(q)) ||
          (d.car && `${d.car.brand} ${d.car.model} ${d.car.number} ${d.car.callsign}`.toLowerCase().includes(q))
      )
      .sort((a, b) => {
        const order = { free: 0, order: 1, busy: 2, offline: 3 };
        return order[STATUS[a.status].group] - order[STATUS[b.status].group] || a.name.localeCompare(b.name, "ru");
      });
  }, [drivers, filter, search]);

  if (!data.ok && data.notConfigured) {
    return (
      <div className="rounded-lg border border-foreground/10 p-6 text-sm">
        <p>Подключение к Яндекс.Флоту не настроено.</p>
        <Link href="/admin/settings/yandex-fleet" className="mt-2 inline-block underline underline-offset-4">
          Настройки → Яндекс.Флот
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${
              filter === f.id ? "border-foreground bg-foreground text-background" : "border-foreground/15 hover:bg-foreground/5"
            }`}
          >
            {f.label} <span className="opacity-60">{counts[f.id]}</span>
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск: ФИО, телефон, машина"
          aria-label="Поиск водителя"
          className="ml-auto w-64 rounded-md border border-foreground/20 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-foreground/50"
        />
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="text-sm text-foreground/60 underline underline-offset-4 hover:text-foreground disabled:opacity-50"
        >
          {refreshing ? "Обновляем..." : "Обновить"}
        </button>
      </div>

      {data.ok && (
        <p className="mt-2 text-xs text-foreground/40">
          Яндекс.Флот · обновлено {new Date(data.fetchedAt).toLocaleTimeString("ru-RU", { timeZone: TZ })}, автообновление
          каждые 30 с
        </p>
      )}
      {!data.ok && <p className="mt-3 text-sm text-red-600">{data.error}</p>}
      {data.ok && pollError && <p className="mt-2 text-xs text-red-600">Последнее обновление не удалось: {pollError}</p>}

      {data.ok && (
        <FitWidth className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-foreground/10 text-left text-foreground/50">
                <th className="py-2 pr-4 font-normal">Водитель</th>
                <th className="py-2 pr-4 font-normal">Статус</th>
                <th className="py-2 pr-4 font-normal">Автомобиль</th>
                <th className="py-2 pr-4 text-right font-normal">Баланс</th>
                <th className="py-2 pr-4 font-normal">Телефон</th>
                <th className="py-2 font-normal">В парке</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((d) => {
                const s = STATUS[d.status];
                return (
                  <tr key={d.id} className="border-b border-foreground/5">
                    <td className="py-2 pr-4 font-medium">{d.name}</td>
                    <td className="py-2 pr-4">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                        {s.label}
                        {d.statusSince && d.status !== "offline" && (
                          <span className="text-xs text-foreground/40">{since(d.statusSince, now)}</span>
                        )}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      {d.car ? (
                        <>
                          {d.car.brand} {d.car.model} <span className="text-foreground/60">{d.car.number}</span>
                          {d.car.callsign && <span className="ml-1 text-xs text-foreground/40">({d.car.callsign})</span>}
                        </>
                      ) : (
                        <span className="text-foreground/40">не привязан</span>
                      )}
                    </td>
                    <td className={`py-2 pr-4 text-right tabular-nums ${d.balance !== null && d.balance < 0 ? "text-red-600" : ""}`}>
                      {d.balance !== null ? rub(d.balance) : "—"}
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {d.phones.map((p) => (
                        <a key={p} href={`tel:${p}`} className="block hover:underline">
                          {p}
                        </a>
                      ))}
                    </td>
                    <td className="py-2 text-foreground/60">{WORK_STATUS[d.workStatus] ?? d.workStatus}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visible.length === 0 && (
            <p className="py-8 text-center text-sm text-foreground/40">
              {drivers.length === 0 ? "В парке нет водителей" : "Никого не найдено"}
            </p>
          )}
        </FitWidth>
      )}
    </div>
  );
}
