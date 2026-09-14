import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// The shop admin panel (/admin/*) is reserved for the OWNER role -- every
// other CRM role gets redirected to /crm/cabinet (see src/proxy.ts). This
// keeps every existing /admin/* page's call sites unchanged even though the
// underlying identity moved from the old single-role AdminUser to a
// multi-role User.
export const verifyAdminSession = cache(async () => {
  const session = await getAdminSession();
  if (!session?.userId || session.role !== "OWNER") {
    redirect("/crm");
  }
  return { userId: session.userId };
});

export const getCurrentAdmin = cache(async () => {
  const session = await getAdminSession();
  if (!session?.userId || session.role !== "OWNER") return null;

  return prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, login: true },
  });
});
