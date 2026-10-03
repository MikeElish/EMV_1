import "server-only";
import type { Vehicle } from "@prisma/client";
import { normalizePlate } from "@/lib/plate";
import { YandexFleetError } from "@/lib/yandex-fleet";
import { isFleetConfigured, listFleetCars, type FleetCar } from "@/lib/yandex-fleet-data";

export type FleetLink = { callsign: string; status: string };

export type FleetReconciliation =
  | { configured: false }
  | { configured: true; error: string }
  | {
      configured: true;
      /** Техника vehicle id -> its car in Яндекс.Флот, or null if missing there. */
      links: Record<string, FleetLink | null>;
      /** Cars in Яндекс.Флот with no match in Техника. */
      fleetOnly: FleetCar[];
    };

const sameVin = (a: string, b: string) => !!a && !!b && a.trim().toUpperCase() === b.trim().toUpperCase();

/** Matches Техника and Яндекс.Флот by plate (any spelling) or VIN. */
export async function reconcileWithFleet(vehicles: Vehicle[]): Promise<FleetReconciliation> {
  if (!(await isFleetConfigured())) return { configured: false };
  let cars: FleetCar[];
  try {
    cars = await listFleetCars();
  } catch (error) {
    return {
      configured: true,
      error: error instanceof YandexFleetError ? error.message : "Не удалось получить данные Яндекс.Флота",
    };
  }

  const used = new Set<string>();
  const links: Record<string, FleetLink | null> = {};
  for (const v of vehicles) {
    const plate = normalizePlate(v.licensePlate);
    const car = cars.find((c) => normalizePlate(c.number) === plate || sameVin(c.vin, v.vin));
    if (car) used.add(car.id);
    links[v.id] = car ? { callsign: car.callsign, status: car.status } : null;
  }
  return { configured: true, links, fleetOnly: cars.filter((c) => !used.has(c.id)) };
}
