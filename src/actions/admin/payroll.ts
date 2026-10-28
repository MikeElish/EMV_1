"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { accessDenied } from "@/lib/access-server";
import { payrollOf } from "@/lib/payroll";

export type ActionResult = { ok: true } | { ok: false; error: string };

const MONTH = /^\d{4}-\d{2}$/;

/**
 * A line of the ведомость changed: «Начислено» typed in keeps it as it is
 * (not recounted), «Наличные», «Должность» and a driver's «Выработка» just
 * stay with it. `reset` returns it to the rule.
 */
export async function savePayrollLine(
  month: string,
  userId: string,
  change: { accrued?: number; cash?: number; output?: number | null; position?: string; reset?: boolean }
): Promise<ActionResult> {
  const denied = await accessDenied("finance.payroll");
  if (denied) return denied;
  if (!MONTH.test(month)) return { ok: false, error: "Некорректный месяц" };
  for (const v of [change.accrued, change.cash, change.output]) if (v !== undefined && v !== null && !(Number.isInteger(v) && v >= 0)) return { ok: false, error: "Суммы — неотрицательные числа" };

  const line = (await payrollOf(month)).find((l) => l.userId === userId);
  if (!line) return { ok: false, error: "Сотрудника нет в ведомости" };
  const manual = change.reset ? false : change.accrued !== undefined ? true : line.manual;
  const data = {
    position: change.position !== undefined ? change.position.trim() || null : line.position || null,
    cash: change.cash ?? line.cash,
    output: change.output !== undefined ? change.output : line.output,
    manual,
    accrued: change.accrued ?? line.accrued,
    calculation: change.accrued !== undefined ? `Скорректировано вручную (по правилу: ${line.calculation})` : line.calculation,
  };
  await prisma.payrollRow.upsert({ where: { month_userId: { month, userId } }, create: { month, userId, ...data }, update: data });
  // A driver's выработка or a reset: the rule counts again.
  if (!manual) {
    const fresh = (await payrollOf(month)).find((l) => l.userId === userId);
    if (fresh) await prisma.payrollRow.update({ where: { month_userId: { month, userId } }, data: { accrued: fresh.accrued, calculation: fresh.calculation } });
  }
  revalidatePath("/admin/finance/payroll");
  return { ok: true };
}
