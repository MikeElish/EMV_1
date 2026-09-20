"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-dal";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function markDriverApplicationContacted(
  id: string,
  contacted: boolean
): Promise<ActionResult> {
  await verifyAdminSession();
  await prisma.driverApplication.update({
    where: { id },
    data: { status: contacted ? "CONTACTED" : "NEW" },
  });
  revalidatePath("/admin/taxi-fleet/driver-applications");
  return { ok: true };
}
