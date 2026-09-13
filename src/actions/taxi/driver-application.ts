"use server";

import { prisma } from "@/lib/prisma";
import {
  driverApplicationSchema,
  type DriverApplicationInput,
} from "@/lib/validators/driver-application";

export type DriverApplicationResult =
  | { ok: true }
  | { ok: false; error: string };

export async function submitDriverApplication(
  input: DriverApplicationInput
): Promise<DriverApplicationResult> {
  const parsed = driverApplicationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Некорректные данные",
    };
  }

  const { name, phone, drivingExperienceYears, previousDriverExperience } =
    parsed.data;

  await prisma.driverApplication.create({
    data: { name, phone, drivingExperienceYears, previousDriverExperience },
  });

  return { ok: true };
}
