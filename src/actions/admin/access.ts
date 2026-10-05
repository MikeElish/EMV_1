"use server";

import { revalidatePath } from "next/cache";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMyAccess } from "@/lib/access-server";
import { isConfigurableRole, parseAccessMap } from "@/lib/access";

export type ActionResult = { ok: true; users: number } | { ok: false; error: string };

/**
 * Настройки → Доступ: the role's template. Every user of the role follows it
 * from now on -- personal rights from their cards are dropped.
 */
export async function saveRoleAccess(role: Role, levels: Record<string, string>): Promise<ActionResult> {
  const me = await getMyAccess();
  if (me?.role !== "OWNER") return { ok: false, error: "Шаблоны доступа настраивает только владелец" };
  if (!Object.values(Role).includes(role) || !isConfigurableRole(role)) {
    return { ok: false, error: "Для этой роли доступ не настраивается" };
  }
  const access = parseAccessMap(levels);
  if (!access) return { ok: false, error: "Задайте доступ ко всем разделам" };

  const [, reset] = await prisma.$transaction([
    prisma.roleAccess.upsert({ where: { role }, create: { role, access }, update: { access } }),
    prisma.user.updateMany({ where: { role }, data: { access: Prisma.DbNull } }),
  ]);
  revalidatePath("/admin/settings/access");
  revalidatePath("/admin/crm/users");
  return { ok: true, users: reset.count };
}
