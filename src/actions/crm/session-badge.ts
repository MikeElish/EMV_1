"use server";

import { getAdminSession } from "@/lib/session";
import type { Role } from "@prisma/client";

export type CrmBadgeInfo = { loggedIn: boolean; label: string | null; role: Role | null };

export async function getCrmBadge(): Promise<CrmBadgeInfo> {
  const session = await getAdminSession();
  if (!session?.userId) return { loggedIn: false, label: null, role: null };
  // Owner's login is their e-mail (long); the badge shows the short brand
  // name instead. Every other role's login is already a short code.
  const label = session.role === "OWNER" ? "emv" : session.login;
  return { loggedIn: true, label, role: session.role };
}
