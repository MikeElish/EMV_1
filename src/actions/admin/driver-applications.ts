"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-dal";
import {
  adminDriverApplicationSchema,
  type AdminDriverApplicationInput,
} from "@/lib/validators/admin-driver-application";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function updateDriverApplication(
  id: string,
  input: AdminDriverApplicationInput
): Promise<ActionResult> {
  await verifyAdminSession();

  const parsed = adminDriverApplicationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }
  const data = parsed.data;

  await prisma.driverApplication.update({
    where: { id },
    data: {
      name: data.name,
      phone: data.phone,
      drivingExperienceYears: data.drivingExperienceYears ?? null,
      previousDriverExperience: data.previousDriverExperience,
      status: data.status,
    },
  });
  revalidatePath("/admin/taxi-fleet/driver-applications");
  return { ok: true };
}

export async function deleteDriverApplication(id: string): Promise<ActionResult> {
  await verifyAdminSession();
  await prisma.driverApplication.delete({ where: { id } });
  revalidatePath("/admin/taxi-fleet/driver-applications");
  return { ok: true };
}
