"use server";

import { utils, write } from "xlsx";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { accessDenied, hasAccess } from "@/lib/access-server";
import { INVITES_PER_DAY, sendInviteLetter, unsubscribeUrl } from "@/lib/newsletter";
import { getMoscowDayRangeUtc } from "@/lib/order-number";

export type InviteResult = { ok: true; message: string } | { ok: false; error: string };

const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

/** «Добавить адреса»: one per line, «email» or «email Имя / компания». */
export async function addInvitees(text: string): Promise<InviteResult> {
  const denied = await accessDenied("crm.newsletter");
  if (denied) return denied;
  const rows = String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 1000);
  let added = 0;
  const bad: string[] = [];
  for (const line of rows) {
    const [first, ...rest] = line.split(/[\s;,\t]+/);
    const email = first.replace(/^<|>$/g, "").toLowerCase();
    if (!EMAIL.test(email)) {
      bad.push(line);
      continue;
    }
    const name = rest.join(" ").trim().slice(0, 120) || null;
    const exists = await prisma.newsletterInvite.findUnique({ where: { email } });
    if (exists) continue;
    await prisma.newsletterInvite.create({ data: { email, name } });
    added++;
  }
  revalidatePath("/admin/crm/newsletter");
  return bad.length
    ? { ok: true, message: `Добавлено: ${added}. Не распознаны: ${bad.slice(0, 5).join("; ")}${bad.length > 5 ? "…" : ""}` }
    : { ok: true, message: `Добавлено: ${added}` };
}

export async function removeInvitee(email: string): Promise<InviteResult> {
  const denied = await accessDenied("crm.newsletter");
  if (denied) return denied;
  await prisma.newsletterInvite.deleteMany({ where: { email: String(email).toLowerCase() } });
  revalidatePath("/admin/crm/newsletter");
  return { ok: true, message: "Убрано" };
}

/**
 * Sends the invitation to each address (not to subscribed ones, not twice),
 * at most INVITES_PER_DAY a day in all.
 */
export async function sendInvites(list: { email: string; name: string | null }[]): Promise<InviteResult> {
  const denied = await accessDenied("crm.newsletter");
  if (denied) return denied;
  if (!Array.isArray(list) || list.length > 500) return { ok: false, error: "Некорректный список" };
  const { start } = getMoscowDayRangeUtc(new Date());
  const sentToday = await prisma.newsletterInvite.count({ where: { sentAt: { gte: start } } });
  let left = INVITES_PER_DAY - sentToday;
  if (left <= 0) return { ok: false, error: `Сегодня уже отправлено ${sentToday} приглашений — продолжим завтра` };

  let sent = 0;
  let skipped = 0;
  const failed: string[] = [];
  for (const item of list) {
    const email = String(item.email).trim().toLowerCase();
    if (!EMAIL.test(email)) continue;
    const [invite, subscriber] = await Promise.all([
      prisma.newsletterInvite.findUnique({ where: { email } }),
      prisma.newsletterSubscriber.findUnique({ where: { email } }),
    ]);
    // Invited once, or already decided (subscribed, pending or unsubscribed).
    if (invite?.sentAt || subscriber) {
      skipped++;
      continue;
    }
    if (left <= 0) break;
    const name = item.name ? String(item.name).slice(0, 120) : invite?.name ?? null;
    try {
      await sendInviteLetter(email, name);
    } catch (error) {
      console.error("[newsletter] invite failed", email, error);
      failed.push(email);
      continue;
    }
    await prisma.newsletterInvite.upsert({
      where: { email },
      create: { email, name, sentAt: new Date() },
      update: { sentAt: new Date() },
    });
    sent++;
    left--;
  }
  revalidatePath("/admin/crm/newsletter");
  const rest = list.length - sent - skipped - failed.length;
  return {
    ok: true,
    message: [
      `Отправлено: ${sent}`,
      skipped ? `пропущено (уже приглашены или подписаны/отписались): ${skipped}` : "",
      failed.length ? `не ушло: ${failed.join(", ")}` : "",
      rest > 0 ? `остальные ${rest} — завтра (не больше ${INVITES_PER_DAY} в день)` : "",
    ]
      .filter(Boolean)
      .join("; "),
  };
}
import type { SheetResult } from "@/actions/admin/supplier-orders";

/**
 * Выгрузка for the mailing service: only confirmed, not unsubscribed
 * addresses, each with its own unsubscribe link (to put in the letter).
 */
export async function exportSubscribers(): Promise<SheetResult> {
  if (!(await hasAccess("crm.newsletter", "view"))) return { ok: false, error: "Нет доступа" };
  const list = await prisma.newsletterSubscriber.findMany({
    where: { confirmedAt: { not: null }, unsubscribedAt: null },
    orderBy: { consentAt: "asc" },
  });
  const users = await prisma.user.findMany({
    where: { email: { in: list.map((s) => s.email) } },
    select: { email: true, firstName: true, lastName: true, company: { select: { name: true } } },
  });
  const byEmail = new Map(users.map((u) => [u.email!.toLowerCase(), u]));
  const rows = list.map((s) => {
    const u = byEmail.get(s.email);
    return {
      Email: s.email,
      Имя: u?.firstName ?? "",
      Фамилия: u?.lastName ?? "",
      Компания: u?.company?.name ?? "",
      "Дата согласия": s.consentAt.toLocaleString("ru-RU", { timeZone: "Europe/Moscow" }),
      "Ссылка отписки": unsubscribeUrl(s.token),
    };
  });
  const book = utils.book_new();
  utils.book_append_sheet(book, utils.json_to_sheet(rows), "Подписчики");
  const date = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Moscow" });
  return { ok: true, base64: write(book, { type: "base64", bookType: "xlsx" }), fileName: `Подписчики ${date}.xlsx` };
}
