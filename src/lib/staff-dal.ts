import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { getAdminSession } from "@/lib/session";
import { hasAccess } from "@/lib/access-server";
import type { AccessLevel } from "@/lib/access";

/**
 * Any signed-in employee -- every role except CUSTOMER. Used by the parts of
 * /admin that aren't owner-only (currently Почта); everything else keeps
 * verifyAdminSession (OWNER).
 */
export const verifyStaffSession = cache(async (): Promise<{ userId: string; role: Role }> => {
  const session = await getAdminSession();
  if (!session?.userId || session.role === "CUSTOMER") {
    redirect("/crm");
  }
  return { userId: session.userId, role: session.role };
});

/**
 * Same check for Почта's server actions -- returns null instead of
 * redirecting, also when Карточка пользователя → Доступ gives Почта less
 * than `level` («Просмотр» reads mail, changes need «Редактирование»).
 */
export async function getStaffSession(level: AccessLevel = "edit"): Promise<{ userId: string; role: Role } | null> {
  const session = await getAdminSession();
  if (!session?.userId || session.role === "CUSTOMER") return null;
  if (!(await hasAccess("mail", level))) return null;
  return { userId: session.userId, role: session.role };
}
