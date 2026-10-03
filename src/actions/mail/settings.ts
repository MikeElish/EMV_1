"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getStaffSession } from "@/lib/staff-dal";
import { encryptSecret } from "@/lib/secret-box";
import { getMailAccount } from "@/lib/mail/account";
import { listFolders, MailError } from "@/lib/mail/imap";
import { invalidateUnread } from "@/lib/mail/unread";
import { MAX_SIGNATURE_LOGO_BYTES, sniffImageType } from "@/lib/mail/signature-logo";
import { userMailboxSchema } from "@/lib/validators/mail-settings";
import { mailPreferencesSchema, type MailPreferencesInput } from "@/lib/validators/mail";

export type SettingsResult = { ok: true; message: string } | { ok: false; error: string };

function refresh(userId: string) {
  invalidateUnread(userId);
  revalidatePath("/admin/mail", "layout");
  revalidatePath("/admin/settings/mail");
}

/** Почтовые программы: the employee's own login + app password. */
export async function saveMyMailbox(input: { login: string; password?: string }): Promise<SettingsResult> {
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Требуется вход" };

  const parsed = userMailboxSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };

  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { mailPasswordEnc: true } });
  if (!parsed.data.password && !user?.mailPasswordEnc) return { ok: false, error: "Укажите пароль приложения" };

  await prisma.user.update({
    where: { id: session.userId },
    data: {
      mailLogin: parsed.data.login,
      ...(parsed.data.password ? { mailPasswordEnc: encryptSecret(parsed.data.password) } : {}),
    },
  });
  refresh(session.userId);
  return testMyMailbox();
}

export async function testMyMailbox(): Promise<SettingsResult> {
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Требуется вход" };
  const account = await getMailAccount(session.userId);
  if (!account) return { ok: false, error: "Почта не настроена" };
  try {
    const folders = await listFolders(account);
    return { ok: true, message: `Сохранено. Подключение работает, папок в ящике: ${folders.length}` };
  } catch (error) {
    return {
      ok: false,
      error: "Сохранено, но подключиться не удалось. " + (error instanceof MailError ? error.message : ""),
    };
  }
}

export async function clearMyMailbox(): Promise<SettingsResult> {
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Требуется вход" };
  await prisma.user.update({ where: { id: session.userId }, data: { mailLogin: null, mailPasswordEnc: null } });
  refresh(session.userId);
  return { ok: true, message: "Ящик отключён" };
}

export async function uploadSignatureLogo(form: FormData): Promise<SettingsResult> {
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Требуется вход" };
  const file = form.get("logo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Выберите файл" };
  if (file.size > MAX_SIGNATURE_LOGO_BYTES) {
    return { ok: false, error: "Логотип больше 300 КБ — уменьшите картинку" };
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type) return { ok: false, error: "Нужна картинка PNG, JPEG или GIF" };

  await prisma.user.update({
    where: { id: session.userId },
    data: { mailSignatureLogo: bytes, mailSignatureLogoType: type },
  });
  revalidatePath("/admin/mail", "layout");
  return { ok: true, message: "Логотип сохранён" };
}

export async function deleteSignatureLogo(): Promise<SettingsResult> {
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Требуется вход" };
  await prisma.user.update({
    where: { id: session.userId },
    data: { mailSignatureLogo: null, mailSignatureLogoType: null },
  });
  revalidatePath("/admin/mail", "layout");
  return { ok: true, message: "Логотип удалён" };
}

export async function saveMailPreferences(input: MailPreferencesInput): Promise<SettingsResult> {
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Требуется вход" };
  const parsed = mailPreferencesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  await prisma.user.update({
    where: { id: session.userId },
    data: {
      mailSenderName: parsed.data.senderName || null,
      mailSignature: parsed.data.signature?.trim() ? parsed.data.signature.replace(/\r\n/g, "\n") : null,
      mailPageSize: parsed.data.pageSize,
    },
  });
  revalidatePath("/admin/mail", "layout");
  return { ok: true, message: "Сохранено" };
}
