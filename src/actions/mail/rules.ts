"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyStaffSession } from "@/lib/staff-dal";
import { MailError } from "@/lib/mail/imap";
import { applyRuleToInbox } from "@/lib/mail/rules";
import { describeConditions, mailRuleSchema, type MailRuleInput } from "@/lib/validators/mail-rules";

export type RuleActionResult = { ok: true; applied?: number } | { ok: false; error: string };

const SETTINGS = "/admin/mail/settings";

/**
 * Rules start with the letters arriving from now on: when the first rule is
 * switched on, processing restarts from the current end of Входящие.
 */
async function restartIfFirst(userId: string, hadEnabled: boolean) {
  if (hadEnabled) return;
  await prisma.mailRuleState.deleteMany({ where: { userId } });
}

const hasEnabled = (userId: string) =>
  prisma.mailRule.count({ where: { userId, enabled: true } }).then((n) => n > 0);

export async function saveMailRule(
  id: string | null,
  input: MailRuleInput,
  applyToInbox: boolean
): Promise<RuleActionResult> {
  const { userId } = await verifyStaffSession();
  const parsed = mailRuleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректное правило" };
  const data = parsed.data;

  const fields = {
    name: data.name || describeConditions(data.conditions, data.matchAll).slice(0, 120),
    matchAll: data.matchAll,
    conditions: data.conditions,
    attachments: data.attachments,
    moveTo: data.moveTo || null,
    markRead: data.markRead,
    flag: data.flag,
    remove: data.remove,
    forwardTo: data.forwardTo || null,
    replyText: data.replyText || null,
    stopProcessing: data.stopProcessing,
  };

  const hadEnabled = await hasEnabled(userId);
  let ruleId = id;
  if (id) {
    const existing = await prisma.mailRule.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) return { ok: false, error: "Правило не найдено" };
    await prisma.mailRule.update({ where: { id }, data: fields });
  } else {
    const last = await prisma.mailRule.aggregate({ where: { userId }, _max: { position: true } });
    const created = await prisma.mailRule.create({
      data: { ...fields, userId, position: (last._max.position ?? -1) + 1 },
    });
    ruleId = created.id;
  }
  await restartIfFirst(userId, hadEnabled);

  let applied: number | undefined;
  if (applyToInbox && ruleId) {
    try {
      applied = await applyRuleToInbox(userId, ruleId);
    } catch (error) {
      revalidatePath(SETTINGS);
      return {
        ok: false,
        error: `Правило сохранено, но применить его к письмам не удалось: ${
          error instanceof MailError ? error.message : "ошибка почтового сервера"
        }`,
      };
    }
  }
  revalidatePath(SETTINGS);
  return { ok: true, applied };
}

export async function setMailRuleEnabled(id: string, enabled: boolean): Promise<RuleActionResult> {
  const { userId } = await verifyStaffSession();
  const rule = await prisma.mailRule.findUnique({ where: { id } });
  if (!rule || rule.userId !== userId) return { ok: false, error: "Правило не найдено" };
  const hadEnabled = await hasEnabled(userId);
  await prisma.mailRule.update({ where: { id }, data: { enabled } });
  if (enabled) await restartIfFirst(userId, hadEnabled);
  revalidatePath(SETTINGS);
  return { ok: true };
}

export async function deleteMailRule(id: string): Promise<RuleActionResult> {
  const { userId } = await verifyStaffSession();
  const rule = await prisma.mailRule.findUnique({ where: { id } });
  if (!rule || rule.userId !== userId) return { ok: false, error: "Правило не найдено" };
  await prisma.mailRule.delete({ where: { id } });
  revalidatePath(SETTINGS);
  return { ok: true };
}

/** Rules apply top to bottom (matters with «Не применять остальные правила»). */
export async function moveMailRule(id: string, direction: -1 | 1): Promise<RuleActionResult> {
  const { userId } = await verifyStaffSession();
  const rules = await prisma.mailRule.findMany({ where: { userId }, orderBy: { position: "asc" } });
  const index = rules.findIndex((r) => r.id === id);
  const other = rules[index + direction];
  if (index < 0 || !other) return { ok: true };
  const reordered = [...rules];
  [reordered[index], reordered[index + direction]] = [other, rules[index]];
  await prisma.$transaction(
    reordered.map((r, position) => prisma.mailRule.update({ where: { id: r.id }, data: { position } }))
  );
  revalidatePath(SETTINGS);
  return { ok: true };
}
