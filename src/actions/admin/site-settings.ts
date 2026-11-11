"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getMyAccess } from "@/lib/access-server";

export type SiteSettingsResult = { ok: true } | { ok: false; error: string };

export async function setManualInputEnabled(enabled: boolean): Promise<SiteSettingsResult> {
  const me = await getMyAccess();
  if (me?.role !== "OWNER") return { ok: false, error: "Настраивать ручной ввод может только владелец" };
  if (typeof enabled !== "boolean") return { ok: false, error: "Некорректное значение" };

  await prisma.siteSettings.upsert({
    where: { id: 1 },
    create: { id: 1, manualInputEnabled: enabled },
    update: { manualInputEnabled: enabled },
  });
  revalidatePath("/admin/settings/site");
  revalidatePath("/admin/crm/orders");
  revalidatePath("/admin/crm/supplier-orders");
  return { ok: true };
}
