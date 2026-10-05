"use server";

import { prisma } from "@/lib/prisma";
import { requireSection } from "@/lib/access-server";
import { getGlonassVehicles, GlonassError, type GlonassVehicle } from "@/lib/glonass";
import { normalizePlate } from "@/lib/plate";

export type MapVehicle = GlonassVehicle & {
  /** Brand + model from Таксопарк → Техника when the plate matches. */
  fleetName: string | null;
};

export type GlonassMapResult =
  | { ok: true; vehicles: MapVehicle[]; fetchedAt: string }
  | { ok: false; error: string; notConfigured?: boolean };

export async function getGlonassMapData(): Promise<GlonassMapResult> {
  await requireSection("taxi.glonass", "view");

  try {
    const [vehicles, fleet] = await Promise.all([
      getGlonassVehicles(),
      prisma.vehicle.findMany({ select: { licensePlate: true, brand: true, model: true } }),
    ]);
    const fleetByPlate = new Map(fleet.map((v) => [normalizePlate(v.licensePlate), `${v.brand} ${v.model}`]));
    return {
      ok: true,
      fetchedAt: new Date().toISOString(),
      vehicles: vehicles.map((v) => ({ ...v, fleetName: fleetByPlate.get(normalizePlate(v.number)) ?? null })),
    };
  } catch (error) {
    if (error instanceof GlonassError) {
      return {
        ok: false,
        error: error.message,
        notConfigured: !(await prisma.glonassSettings.count()),
      };
    }
    console.error("[glonass] map data failed:", error);
    return { ok: false, error: "Не удалось получить данные ГЛОНАСС" };
  }
}
