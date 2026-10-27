"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { accessDenied, hasAccess } from "@/lib/access-server";
import { OneCError } from "@/lib/onec";
import { getWarehouseData } from "@/lib/onec-warehouse";

export type WarehouseActionResult = { ok: true } | { ok: false; error: string };

/** Место хранения of an item on a warehouse; empty clears it. */
export async function setStoragePlace(warehouseRef: string, itemRef: string, place: string): Promise<WarehouseActionResult> {
  const denied = await accessDenied("warehouse");
  if (denied) return denied;
  const value = place.trim().slice(0, 100);
  if (!/^[0-9a-f-]{36}$/i.test(warehouseRef) || !/^[0-9a-f-]{36}$/i.test(itemRef)) {
    return { ok: false, error: "Некорректный склад или товар" };
  }
  if (value) {
    await prisma.storagePlace.upsert({
      where: { warehouseRef_itemRef: { warehouseRef, itemRef } },
      create: { warehouseRef, itemRef, place: value },
      update: { place: value },
    });
  } else {
    await prisma.storagePlace.deleteMany({ where: { warehouseRef, itemRef } });
  }
  revalidatePath("/admin/warehouse", "layout");
  return { ok: true };
}

/** «Обновить»: reads 1С again instead of the 5-minute copy. */
export async function refreshWarehouseData(): Promise<WarehouseActionResult> {
  if (!(await hasAccess(["warehouse", "reports.movements"], "view"))) return { ok: false, error: "Нет доступа" };
  try {
    await getWarehouseData(true);
  } catch (error) {
    return { ok: false, error: error instanceof OneCError ? error.message : "1С не ответила" };
  }
  revalidatePath("/admin/warehouse", "layout");
  revalidatePath("/admin/reports/movements");
  return { ok: true };
}
