"use server";

import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-dal";
import { getGlonassVehicles, GlonassError, normalizePlate, type GlonassVehicle } from "@/lib/glonass";

export type MapVehicle = GlonassVehicle & {
  /** Brand + model from Таксопарк → Техника when the plate matches. */
  fleetName: string | null;
};

export type GlonassMapResult =
  | { ok: true; vehicles: MapVehicle[]; fetchedAt: string }
  | { ok: false; error: string; notConfigured?: boolean };

export async function getGlonassMapData(): Promise<GlonassMapResult> {
  await verifyAdminSession();

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
