"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { accessDenied } from "@/lib/access-server";

export type ActionResult = { ok: true } | { ok: false; error: string };

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Финансы → Налоги: the patent's cost and term, the fixed contributions. */
export async function saveTaxSettings(input: { patentCost: number; patentFrom: string; patentTo: string; insuranceFixed: number }): Promise<ActionResult> {
  const denied = await accessDenied("finance.taxes");
  if (denied) return denied;
  if (!(input.patentCost >= 0) || !(input.insuranceFixed >= 0)) return { ok: false, error: "Суммы не могут быть отрицательными" };
  if ((input.patentFrom && !DAY.test(input.patentFrom)) || (input.patentTo && !DAY.test(input.patentTo))) return { ok: false, error: "Укажите даты патента" };
  if (input.patentFrom && input.patentTo && input.patentTo < input.patentFrom) return { ok: false, error: "Патент заканчивается раньше, чем начинается" };
  const data = {
    patentCost: Math.round(input.patentCost),
    patentFrom: input.patentFrom ? new Date(`${input.patentFrom}T12:00:00+03:00`) : null,
    patentTo: input.patentTo ? new Date(`${input.patentTo}T12:00:00+03:00`) : null,
    insuranceFixed: Math.round(input.insuranceFixed),
  };
  await prisma.taxSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
  revalidatePath("/admin/finance/taxes");
  return { ok: true };
}
