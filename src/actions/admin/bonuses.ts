"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { accessDenied } from "@/lib/access-server";
import { ownerManualInputEnabled } from "@/lib/manual-input";
import { bonusPeriodDates, bonusesReport } from "@/lib/bonuses-report";

export type BonusActionResult = { ok: true; number?: number } | { ok: false; error: string };

function validPeriod(from: string, to: string) {
  const isDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  return isDate(from) && isDate(to) && from <= to;
}

export async function saveBonusOverride(
  companyId: string,
  managerId: string,
  from: string,
  to: string,
  amount: number | null
): Promise<BonusActionResult> {
  const denied = await accessDenied("finance.bonuses");
  if (denied) return denied;
  if (!(await ownerManualInputEnabled())) return { ok: false, error: "Ручной ввод выключен в настройках сайта" };
  if (!companyId || !managerId || !validPeriod(from, to)) return { ok: false, error: "Некорректная компания, менеджер или период" };
  if (amount !== null && (!Number.isInteger(amount) || amount < 0 || amount > 1_000_000_000_000)) {
    return { ok: false, error: "Бонус должен быть неотрицательной суммой в копейках" };
  }

  const { periodFrom, periodTo } = bonusPeriodDates(from, to);
  const where = { managerId_companyId_periodFrom_periodTo: { managerId, companyId, periodFrom, periodTo } };
  const existing = await prisma.bonusSettlement.findUnique({
    where,
    select: { id: true, paymentRequest: { select: { id: true } } },
  });
  if (existing?.paymentRequest) return { ok: false, error: "Бонус уже включён в заявку на оплату; сначала отмените её" };
  if (amount === null && !existing) return { ok: true };

  await prisma.bonusSettlement.upsert({
    where,
    create: { managerId, companyId, periodFrom, periodTo, bonusOverride: amount },
    update: { bonusOverride: amount },
  });
  revalidatePath("/admin/finance/bonuses");
  return { ok: true };
}

export async function createBonusPaymentRequest(
  companyId: string,
  managerId: string,
  from: string,
  to: string
): Promise<BonusActionResult> {
  const denied = await accessDenied("finance.bonuses");
  if (denied) return denied;
  if (!validPeriod(from, to)) return { ok: false, error: "Некорректный период" };
  if (!companyId || !managerId) return { ok: false, error: "Для выплаты назначьте менеджера компании" };

  const row = (await bonusesReport(from, to)).find(
    (item) => item.companyId === companyId && item.managerId === managerId
  );
  if (!row) return { ok: false, error: "За этот период нет поставленных заказов компании" };
  if (row.requestNumber) return { ok: true, number: row.requestNumber };
  if (row.bonus <= 0) return { ok: false, error: "Сумма бонуса должна быть больше нуля" };

  const { periodFrom, periodTo } = bonusPeriodDates(from, to);
  const settlement = await prisma.bonusSettlement.upsert({
    where: { managerId_companyId_periodFrom_periodTo: { managerId, companyId, periodFrom, periodTo } },
    create: { managerId, companyId, periodFrom, periodTo },
    update: {},
  });
  const request = await prisma.paymentRequest.upsert({
    where: { bonusSettlementId: settlement.id },
    create: {
      amount: row.bonus,
      purpose: `Выплата бонуса менеджеру ${row.manager} · ${row.company} · ${from} — ${to}`,
      purposeCategory: "BONUSES",
      fund: "SALARY",
      managerId,
      bonusCompanyId: companyId,
      bonusPeriodFrom: periodFrom,
      bonusPeriodTo: periodTo,
      bonusSettlementId: settlement.id,
    },
    update: {},
    select: { number: true },
  });
  revalidatePath("/admin/finance/bonuses");
  revalidatePath("/admin/finance/payment-requests");
  return { ok: true, number: request.number };
}
