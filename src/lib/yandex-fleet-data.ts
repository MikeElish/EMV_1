import "server-only";
import { prisma } from "@/lib/prisma";
import { fleetRequest } from "@/lib/yandex-fleet";

export type FleetDriverStatus = "free" | "busy" | "in_order_free" | "in_order_busy" | "offline";

export type FleetDriver = {
  id: string;
  name: string;
  phones: string[];
  /** Работает / Не работает / Уволен in the park. */
  workStatus: string;
  /** On the line right now. */
  status: FleetDriverStatus;
  statusSince: string | null;
  balance: number | null;
  car: { brand: string; model: string; number: string; callsign: string } | null;
};

export type FleetCar = {
  id: string;
  brand: string;
  model: string;
  color: string;
  year: number | null;
  number: string;
  vin: string;
  registrationCert: string;
  status: string;
  callsign: string;
};

type DriversPage = {
  total: number;
  driver_profiles: {
    accounts?: { balance?: string; type?: string }[];
    car?: { brand?: string; model?: string; number?: string; callsign?: string };
    current_status?: { status?: string; status_updated_at?: string };
    driver_profile?: {
      id: string;
      first_name?: string;
      last_name?: string;
      middle_name?: string;
      phones?: string[];
      work_status?: string;
    };
  }[];
};

type CarsPage = {
  total: number;
  cars: {
    id: string;
    brand?: string;
    model?: string;
    color?: string;
    year?: number;
    number?: string;
    vin?: string;
    registration_cert?: string;
    status?: string;
    callsign?: string;
  }[];
};

const PAGE = 500;
const TTL_MS = 15 * 1000;

// Several open Диспетчерская / Техника tabs share one upstream call.
const globalCache = globalThis as unknown as { __emvFleetCache?: Map<string, { at: number; data: Promise<unknown> }> };
const cache: Map<string, { at: number; data: Promise<unknown> }> = (globalCache.__emvFleetCache ??= new Map());

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data as Promise<T>;
  const data = load();
  cache.set(key, { at: Date.now(), data });
  data.catch(() => {
    if (cache.get(key)?.data === data) cache.delete(key);
  });
  return data;
}

async function parkQuery() {
  const settings = await prisma.yandexFleetSettings.findUnique({ where: { id: 1 }, select: { parkId: true } });
  return { park: { id: settings?.parkId ?? "" } };
}

const KNOWN_STATUSES: FleetDriverStatus[] = ["free", "busy", "in_order_free", "in_order_busy", "offline"];

export function listFleetDrivers(): Promise<FleetDriver[]> {
  return cached("drivers", async () => {
    const query = await parkQuery();
    const out: FleetDriver[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const page = await fleetRequest<DriversPage>("/v1/parks/driver-profiles/list", {
        query,
        limit: PAGE,
        offset,
        fields: {
          account: ["balance", "type"],
          car: ["brand", "model", "number", "callsign"],
          current_status: ["status", "status_updated_at"],
          driver_profile: ["id", "first_name", "last_name", "middle_name", "phones", "work_status"],
        },
      });
      for (const item of page.driver_profiles ?? []) {
        const profile = item.driver_profile;
        if (!profile) continue;
        const status = item.current_status?.status as FleetDriverStatus | undefined;
        const balance = item.accounts?.find((a) => a.type === "current") ?? item.accounts?.[0];
        out.push({
          id: profile.id,
          name: [profile.last_name, profile.first_name, profile.middle_name].filter(Boolean).join(" ") || "—",
          phones: profile.phones ?? [],
          workStatus: profile.work_status ?? "",
          status: status && KNOWN_STATUSES.includes(status) ? status : "offline",
          statusSince: item.current_status?.status_updated_at ?? null,
          balance: balance?.balance !== undefined ? Number(balance.balance) : null,
          car: item.car?.number
            ? {
                brand: item.car.brand ?? "",
                model: item.car.model ?? "",
                number: item.car.number,
                callsign: item.car.callsign ?? "",
              }
            : null,
        });
      }
      if (offset + PAGE >= (page.total ?? 0)) break;
    }
    return out;
  });
}

export function listFleetCars(): Promise<FleetCar[]> {
  return cached("cars", async () => {
    const query = await parkQuery();
    const out: FleetCar[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const page = await fleetRequest<CarsPage>("/v1/parks/cars/list", { query, limit: PAGE, offset });
      for (const car of page.cars ?? []) {
        out.push({
          id: car.id,
          brand: car.brand ?? "",
          model: car.model ?? "",
          color: car.color ?? "",
          year: car.year ?? null,
          number: car.number ?? "",
          vin: car.vin ?? "",
          registrationCert: car.registration_cert ?? "",
          status: car.status ?? "",
          callsign: car.callsign ?? "",
        });
      }
      if (offset + PAGE >= (page.total ?? 0)) break;
    }
    return out;
  });
}

export async function isFleetConfigured() {
  return (await prisma.yandexFleetSettings.count()) > 0;
}
