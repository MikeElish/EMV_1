"use server";

import { utils, write } from "xlsx";
import { prisma } from "@/lib/prisma";
import { hasAccess } from "@/lib/access-server";
import { unsubscribeUrl } from "@/lib/newsletter";
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
