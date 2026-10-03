import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { getAdminSession } from "@/lib/session";

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

/** Same check for server actions: returns null instead of redirecting. */
export async function getStaffSession(): Promise<{ userId: string; role: Role } | null> {
  const session = await getAdminSession();
  if (!session?.userId || session.role === "CUSTOMER") return null;
  return { userId: session.userId, role: session.role };
}
