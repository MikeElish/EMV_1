"use server";

import { verifyAdminSession } from "@/lib/admin-dal";
import { YandexFleetError } from "@/lib/yandex-fleet";
import { isFleetConfigured, listFleetDrivers, type FleetDriver } from "@/lib/yandex-fleet-data";

export type DispatchResult =
  | { ok: true; drivers: FleetDriver[]; fetchedAt: string }
  | { ok: false; error: string; notConfigured?: boolean };

export async function getDispatchData(): Promise<DispatchResult> {
  await verifyAdminSession();
  if (!(await isFleetConfigured())) {
    return { ok: false, notConfigured: true, error: "Подключение к Яндекс.Флоту не настроено" };
  }
  try {
    return { ok: true, drivers: await listFleetDrivers(), fetchedAt: new Date().toISOString() };
  } catch (error) {
    if (error instanceof YandexFleetError) return { ok: false, error: error.message };
    console.error("[dispatch] fleet request failed:", error);
    return { ok: false, error: "Не удалось получить данные Яндекс.Флота" };
  }
}
