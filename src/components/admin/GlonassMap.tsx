"use client";

import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Map as LeafletMap, Marker } from "leaflet";
import { getGlonassMapData, type GlonassMapResult, type MapVehicle } from "@/actions/admin/glonass-map";

const POLL_MS = 15000;
// No fresh point for this long -- the tracker is considered offline.
const STALE_MS = 60 * 60 * 1000;
const DEFAULT_CENTER: [number, number] = [59.9386, 30.3141]; // Санкт-Петербург

type Status = "moving" | "parked" | "stale" | "nodata";

function statusOf(v: MapVehicle, now: number): Status {
  if (v.latitude === null || !v.recordTime) return "nodata";
  if (now - new Date(v.recordTime).getTime() > STALE_MS) return "stale";
  return v.ignition ? "moving" : "parked";
}

const STATUS_LABEL: Record<Status, string> = {
  moving: "Зажигание включено",
  parked: "Стоянка",
  stale: "Нет связи",
  nodata: "Нет координат",
};
const STATUS_COLOR: Record<Status, string> = {
  moving: "#16a34a",
  parked: "#2563eb",
  stale: "#d97706",
  nodata: "#6b7280",
};

function ago(iso: string | null, now: number) {
  if (!iso) return "—";
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч ${minutes % 60} мин назад`;
  return new Date(iso).toLocaleString("ru-RU");
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

function markerHtml(v: MapVehicle, status: Status) {
  const color = STATUS_COLOR[status];
  return `<div style="display:flex;align-items:center;gap:4px;transform:translate(-11px,-11px)">
  <svg width="22" height="22" viewBox="0 0 22 22" style="flex:none;width:22px;height:22px;max-width:none;transform:rotate(${v.course ?? 0}deg);filter:drop-shadow(0 1px 2px rgba(0,0,0,.5))">
    <circle cx="11" cy="11" r="10" fill="${color}" stroke="#fff" stroke-width="2"/>
    <path d="M11 4 L16 15 L11 12.5 L6 15 Z" fill="#fff"/>
  </svg>
  <span style="white-space:nowrap;background:#fff;color:#111;font:600 11px/1.2 system-ui,sans-serif;padding:2px 5px;border-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,.4)">${escapeHtml(v.number)}</span>
</div>`;
}

export function GlonassMap({ initial }: { initial: GlonassMapResult }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef(new Map<number, Marker>());
  const fittedRef = useRef(false);
  const [leafletReady, setLeafletReady] = useState(false);
  const [data, setData] = useState<GlonassMapResult>(initial);
  const [now, setNow] = useState(() => Date.now());
  const [refreshing, setRefreshing] = useState(false);
  // A failed poll keeps the last good picture on screen and says so here.
  const [pollError, setPollError] = useState<string | null>(null);

  // Map instance.
  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      const map = L.map(containerRef.current, { zoomControl: true }).setView(DEFAULT_CENTER, 10);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
      mapRef.current = map;
      setLeafletReady(true);
    });
    const markers = markersRef.current;
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markers.clear();
    };
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const next = await getGlonassMapData();
    setRefreshing(false);
    setNow(Date.now());
    setPollError(next.ok ? null : next.error);
    setData((prev) => (next.ok || !prev.ok ? next : prev));
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 30000);
    return () => {
      clearInterval(timer);
      clearInterval(tick);
    };
  }, [refresh]);

  // Sync markers with the latest data.
  useEffect(() => {
    if (!leafletReady || !data.ok) return;
    import("leaflet").then((L) => {
      const map = mapRef.current;
      if (!map) return;
      const markers = markersRef.current;
      const seen = new Set<number>();
      for (const v of data.vehicles) {
        if (v.latitude === null || v.longitude === null) continue;
        seen.add(v.vehicleId);
        const status = statusOf(v, now);
        const icon = L.divIcon({ className: "", html: markerHtml(v, status), iconSize: [0, 0] });
        const tooltip = `<b>${escapeHtml(v.number)}</b>${v.fleetName ? `<br>${escapeHtml(v.fleetName)}` : ""}<br>${STATUS_LABEL[status]} · ${ago(v.recordTime, now)}`;
        const existing = markers.get(v.vehicleId);
        if (existing) {
          existing.setLatLng([v.latitude, v.longitude]).setIcon(icon).setTooltipContent(tooltip);
        } else {
          markers.set(
            v.vehicleId,
            L.marker([v.latitude, v.longitude], { icon, title: v.number }).bindTooltip(tooltip, { direction: "top", offset: [0, -14] }).addTo(map)
          );
        }
      }
      for (const [id, marker] of markers) {
        if (!seen.has(id)) {
          marker.remove();
          markers.delete(id);
        }
      }
      if (!fittedRef.current && markers.size > 0) {
        fittedRef.current = true;
        const bounds = L.latLngBounds([...markers.values()].map((m) => m.getLatLng()));
        map.fitBounds(bounds.pad(0.3), { maxZoom: 15 });
      }
    });
  }, [leafletReady, data, now]);

  function focus(v: MapVehicle) {
    if (v.latitude === null || v.longitude === null || !mapRef.current) return;
    mapRef.current.setView([v.latitude, v.longitude], Math.max(mapRef.current.getZoom(), 15));
    markersRef.current.get(v.vehicleId)?.openTooltip();
  }

  if (!data.ok && data.notConfigured) {
    return (
      <div className="rounded-lg border border-foreground/10 p-6 text-sm">
        <p>Подключение к ГЛОНАСС не настроено.</p>
        <Link href="/admin/settings/glonass" className="mt-2 inline-block underline underline-offset-4">
          Настройки → ГЛОНАСС
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="relative z-0 min-h-[420px] flex-1 overflow-hidden rounded-lg border border-foreground/10">
        <div ref={containerRef} className="h-[70vh] min-h-[420px] w-full" aria-label="Карта ГЛОНАСС" />
      </div>

      <aside className="w-full shrink-0 lg:w-72">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            Объекты{data.ok ? ` (${data.vehicles.length})` : ""}
          </h2>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="text-xs text-foreground/60 underline underline-offset-4 hover:text-foreground disabled:opacity-50"
          >
            {refreshing ? "Обновляем..." : "Обновить"}
          </button>
        </div>
        {data.ok && (
          <p className="mt-1 text-xs text-foreground/40">
            Обновлено {new Date(data.fetchedAt).toLocaleTimeString("ru-RU")}, автообновление каждые 15 с
          </p>
        )}
        {!data.ok && <p className="mt-2 text-sm text-red-600">{data.error}</p>}
        {data.ok && pollError && (
          <p className="mt-2 text-xs text-red-600">Последнее обновление не удалось: {pollError}</p>
        )}

        {data.ok && (
          <ul className="mt-3 space-y-2">
            {data.vehicles.length === 0 && (
              <li className="text-sm text-foreground/50">В учётной записи ГЛОНАСС нет объектов</li>
            )}
            {data.vehicles.map((v) => {
              const status = statusOf(v, now);
              return (
                <li key={v.vehicleId}>
                  <button
                    type="button"
                    onClick={() => focus(v)}
                    disabled={v.latitude === null}
                    className="w-full rounded-md border border-foreground/10 px-3 py-2 text-left transition-colors hover:bg-foreground/5 disabled:cursor-default"
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: STATUS_COLOR[status] }} />
                      <span className="text-sm font-medium">{v.number}</span>
                    </div>
                    {v.fleetName && <div className="mt-0.5 text-xs text-foreground/60">{v.fleetName}</div>}
                    <div className="mt-0.5 text-xs text-foreground/50">
                      {STATUS_LABEL[status]} · {ago(v.recordTime, now)}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>
    </div>
  );
}
