"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { accessDenied } from "@/lib/access-server";
import { encryptSecret } from "@/lib/secret-box";
import {
  siteMailSchema,
  userMailboxSchema,
  type SiteMailInput,
  type UserMailboxInput,
} from "@/lib/validators/mail-settings";

export type ActionResult = { ok: true } | { ok: false; error: string };

const MAIL_PATH = "/admin/settings/mail";

export async function saveSiteMailSettings(input: SiteMailInput): Promise<ActionResult> {
  const denied = await accessDenied("settings.mail");
  if (denied) return denied;

  const parsed = siteMailSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }
  const { password, senderName, ...rest } = parsed.data;

  const existing = await prisma.mailSettings.findUnique({ where: { id: 1 } });
  if (!existing && !password) {
    return { ok: false, error: "Укажите пароль" };
  }

  const data = { ...rest, senderName: senderName || null };
  const passwordEnc = password ? encryptSecret(password) : existing!.passwordEnc;

  await prisma.mailSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...data, passwordEnc },
    update: { ...data, passwordEnc },
  });

  revalidatePath(MAIL_PATH);
  return { ok: true };
}

export async function saveUserMailbox(userId: string, input: UserMailboxInput): Promise<ActionResult> {
  const denied = await accessDenied("settings.mail");
  if (denied) return denied;

  const parsed = userMailboxSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, mailPasswordEnc: true },
  });
  if (!user) return { ok: false, error: "Пользователь не найден" };
  if (user.role === "CUSTOMER") {
    return { ok: false, error: "Почта недоступна для покупателей" };
  }

  const { login, password } = parsed.data;
  if (!password && !user.mailPasswordEnc) {
    return { ok: false, error: "Укажите пароль" };
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      mailLogin: login,
      ...(password ? { mailPasswordEnc: encryptSecret(password) } : {}),
    },
  });

  revalidatePath(MAIL_PATH);
  return { ok: true };
}

export async function clearUserMailbox(userId: string): Promise<ActionResult> {
  const denied = await accessDenied("settings.mail");
  if (denied) return denied;

  await prisma.user.update({
    where: { id: userId },
    data: { mailLogin: null, mailPasswordEnc: null },
  });

  revalidatePath(MAIL_PATH);
  return { ok: true };
}
