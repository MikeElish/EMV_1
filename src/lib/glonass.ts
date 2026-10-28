import "server-only";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/secret-box";

export type GlonassVehicle = {
  vehicleId: number;
  number: string;
  latitude: number | null;
  longitude: number | null;
  course: number | null;
  ignition: boolean | null;
  recordTime: string | null;
};

export class GlonassError extends Error {}

// One AuthId is reused across requests (logging in on every poll would hit
// GlonassSoft's rate limit). Keyed by the settings, so editing them in
// Настройки → ГЛОНАСС forces a fresh login.
let session: { key: string; authId: string } | null = null;
// Several open Диспетчерская tabs share one upstream request per few seconds.
let snapshot: { key: string; at: number; data: Promise<GlonassVehicle[]> } | null = null;
const SNAPSHOT_TTL_MS = 5000;

async function loadSettings() {
  const settings = await prisma.glonassSettings.findUnique({ where: { id: 1 } });
  if (!settings) throw new GlonassError("Подключение не настроено: Настройки → ГЛОНАСС");
  return { ...settings, key: `${settings.serverUrl}|${settings.login}|${settings.passwordEnc}` };
}

async function login(settings: Awaited<ReturnType<typeof loadSettings>>) {
  let response: Response;
  try {
    response = await fetch(`${settings.serverUrl}/api/v3/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: settings.login, password: decryptSecret(settings.passwordEnc) }),
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
  } catch {
    throw new GlonassError(`Сервер ${settings.serverUrl} не отвечает`);
  }
  const body = (await response.json().catch(() => null)) as { AuthId?: string; Error?: string } | null;
  if (!body?.AuthId) {
    throw new GlonassError(body?.Error ? `ГЛОНАСС отклонил вход: ${body.Error}` : "Не удалось войти в ГЛОНАСС");
  }
  session = { key: settings.key, authId: body.AuthId };
  return body.AuthId;
}

type MonitoringResponse = {
  vehicles?: { vehicleId: number; number?: string }[];
  points?: {
    VehicleID: number;
    Latitude?: number;
    Longitude?: number;
    Course?: number;
    Ign?: boolean | null;
    RecordTime?: string;
  }[];
};

/**
 * Objects of the account with their last known position. Uses the same
 * endpoint as GlonassSoft's own monitoring screen (`GET /api/monitoringVehicles`),
 * which returns the vehicle list and last points in one call.
 */
async function fetchMonitoring(settings: Awaited<ReturnType<typeof loadSettings>>) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const authId = session?.key === settings.key ? session.authId : await login(settings);
    let response: Response;
    try {
      response = await fetch(`${settings.serverUrl}/api/monitoringVehicles`, {
        headers: { "X-Auth": authId },
        signal: AbortSignal.timeout(15000),
        cache: "no-store",
      });
    } catch {
      throw new GlonassError(`Сервер ${settings.serverUrl} не отвечает`);
    }
    if (response.status === 401 || response.status === 403) {
      // Token expired -- log in again once.
      session = null;
      continue;
    }
    if (!response.ok) throw new GlonassError(`ГЛОНАСС вернул ошибку (HTTP ${response.status})`);
    const body = (await response.json().catch(() => null)) as MonitoringResponse | null;
    if (!body?.vehicles) throw new GlonassError("ГЛОНАСС вернул неожиданный ответ");

    const points = new Map((body.points ?? []).map((p) => [p.VehicleID, p]));
    return body.vehicles.map<GlonassVehicle>((v) => {
      const point = points.get(v.vehicleId);
      const hasPosition = typeof point?.Latitude === "number" && typeof point?.Longitude === "number";
      return {
        vehicleId: v.vehicleId,
        number: v.number ?? String(v.vehicleId),
        latitude: hasPosition ? point!.Latitude! : null,
        longitude: hasPosition ? point!.Longitude! : null,
        course: point?.Course ?? null,
        ignition: point?.Ign ?? null,
        recordTime: point?.RecordTime ?? null,
      };
    });
  }
  throw new GlonassError("ГЛОНАСС не принял авторизацию");
}

export async function getGlonassVehicles(): Promise<GlonassVehicle[]> {
  const settings = await loadSettings();
  if (snapshot && snapshot.key === settings.key && Date.now() - snapshot.at < SNAPSHOT_TTL_MS) {
    return snapshot.data;
  }
  const data = fetchMonitoring(settings);
  snapshot = { key: settings.key, at: Date.now(), data };
  data.catch(() => {
    if (snapshot?.data === data) snapshot = null;
  });
  return data;
}

export type GlonassMileage = { vehicleId: number; number: string; km: number };

const mileageCache = new Map<string, { at: number; data: GlonassMileage[] }>();

/**
 * Пробег of every object of the account between two moments
 * (`POST /api/v3/vehicles/mileageAndMotohours`). A finished month is kept for
 * a day, a running one for 10 minutes.
 */
export async function getGlonassMileage(from: Date, to: Date): Promise<GlonassMileage[]> {
  const settings = await loadSettings();
  const key = `${settings.key}|${from.toISOString()}|${to.toISOString()}`;
  const kept = mileageCache.get(key);
  const ttl = to.getTime() < Date.now() ? 24 * 3600 * 1000 : 10 * 60 * 1000;
  if (kept && Date.now() - kept.at < ttl) return kept.data;

  const vehicles = await getGlonassVehicles();
  if (!vehicles.length) return [];
  const fmt = (d: Date) => d.toISOString().slice(0, 19);
  for (let attempt = 0; attempt < 2; attempt++) {
    const authId = session?.key === settings.key ? session.authId : await login(settings);
    const response = await fetch(`${settings.serverUrl}/api/v3/vehicles/mileageAndMotohours`, {
      method: "POST",
      headers: { "X-Auth": authId, "Content-Type": "application/json" },
      body: JSON.stringify({ vehicleIds: vehicles.map((v) => v.vehicleId), from: fmt(from), to: fmt(to > new Date() ? new Date() : to) }),
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    }).catch(() => {
      throw new GlonassError(`Сервер ${settings.serverUrl} не отвечает`);
    });
    if (response.status === 401 || response.status === 403) {
      session = null;
      continue;
    }
    if (!response.ok) throw new GlonassError(`ГЛОНАСС вернул ошибку пробега (HTTP ${response.status})`);
    const body = (await response.json()) as { vehicleId: number; name?: string; periods?: { mileage?: number | null }[] }[];
    const data = body.map((v) => ({
      vehicleId: v.vehicleId,
      number: v.name ?? String(v.vehicleId),
      km: Math.round((v.periods ?? []).reduce((s, p) => s + (p.mileage ?? 0), 0)),
    }));
    mileageCache.set(key, { at: Date.now(), data });
    return data;
  }
  throw new GlonassError("ГЛОНАСС не принял авторизацию");
}
