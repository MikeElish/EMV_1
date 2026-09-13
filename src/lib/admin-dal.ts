import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const verifyAdminSession = cache(async () => {
  const session = await getAdminSession();
  if (!session?.adminId) {
    redirect("/admin/login");
  }
  return { adminId: session.adminId };
});

export const getCurrentAdmin = cache(async () => {
  const session = await getAdminSession();
  if (!session?.adminId) return null;

  const admin = await prisma.adminUser.findUnique({
    where: { id: session.adminId },
    select: { id: true, email: true },
  });
  return admin;
});
