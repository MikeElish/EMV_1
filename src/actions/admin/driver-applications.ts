"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { accessDenied } from "@/lib/access-server";
import {
  adminDriverApplicationSchema,
  type AdminDriverApplicationInput,
} from "@/lib/validators/admin-driver-application";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function updateDriverApplication(
  id: string,
  input: AdminDriverApplicationInput
): Promise<ActionResult> {
  const denied = await accessDenied("taxi.driver-applications");
  if (denied) return denied;

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
  const denied = await accessDenied("taxi.driver-applications");
  if (denied) return denied;
  await prisma.driverApplication.delete({ where: { id } });
  revalidatePath("/admin/taxi-fleet/driver-applications");
  return { ok: true };
}
