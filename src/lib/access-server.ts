import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { getAdminSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ACCESS_SECTIONS, atLeast, resolveAccess, type AccessLevel, type AccessMap } from "@/lib/access";

export type MyAccess = { userId: string; role: Role; access: AccessMap };

/** The signed-in employee and their levels (read once per request). */
export const getMyAccess = cache(async (): Promise<MyAccess | null> => {
  const session = await getAdminSession();
  if (!session?.userId || session.role === "CUSTOMER") return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true, access: true } });
  if (!user || user.role === "CUSTOMER") return null;
  const template = await prisma.roleAccess.findUnique({ where: { role: user.role } });
  return { userId: session.userId, role: user.role, access: resolveAccess(user.role, user.access, template?.access) };
});

const labelOf = (key: string) => ACCESS_SECTIONS.find((s) => s.key === key)?.label ?? key;

/** Has at least `level` in any of the sections. */
export async function hasAccess(keys: string | string[], level: AccessLevel): Promise<boolean> {
  const me = await getMyAccess();
  if (!me) return false;
  return (Array.isArray(keys) ? keys : [keys]).some((k) => atLeast(me.access[k] ?? "hide", level));
}

/**
 * For server actions that answer `{ ok: false, error }`: null when allowed,
 * otherwise the error to return.
 */
export async function accessDenied(
  keys: string | string[],
  level: AccessLevel = "edit"
): Promise<{ ok: false; error: string } | null> {
  if (await hasAccess(keys, level)) return null;
  const first = Array.isArray(keys) ? keys[0] : keys;
  const me = await getMyAccess();
  if (!me) return { ok: false, error: "Требуется вход" };
  return {
    ok: false,
    error:
      level === "edit"
        ? `Нет прав на изменения в разделе «${labelOf(first)}» — только просмотр`
        : `Нет доступа к разделу «${labelOf(first)}»`,
  };
}

/** For pages and actions with other answers: no access -- off to the start. */
export async function requireSection(keys: string | string[], level: AccessLevel = "view"): Promise<{ userId: string }> {
  const me = await getMyAccess();
  if (!me || !(await hasAccess(keys, level))) redirect("/crm");
  return { userId: me.userId };
}

/** Deleting journal records is the owner's: null when allowed, otherwise the error. */
export async function ownerOnly(): Promise<{ ok: false; error: string } | null> {
  const me = await getMyAccess();
  return me?.role === "OWNER" ? null : { ok: false, error: "Удалять записи может только владелец" };
}
