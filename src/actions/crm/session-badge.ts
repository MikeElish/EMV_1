"use server";

import { getAdminSession } from "@/lib/session";

export type CrmBadgeInfo = { loggedIn: boolean; label: string | null };

export async function getCrmBadge(): Promise<CrmBadgeInfo> {
  const session = await getAdminSession();
  if (!session?.userId) return { loggedIn: false, label: null };
  // Owner's login is their e-mail (long); the badge shows the short brand
  // name instead. Every other role's login is already a short code.
  const label = session.role === "OWNER" ? "emv" : session.login;
  return { loggedIn: true, label };
}
