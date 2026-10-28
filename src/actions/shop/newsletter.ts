"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/session";
import { recordConsent, sendConfirmationLetter, withdrawConsent } from "@/lib/newsletter";

export type NewsletterResult = { ok: true; message: string } | { ok: false; error: string };

const emailSchema = z.string().trim().toLowerCase().email("Укажите корректный e-mail").max(200);

/** The signed-in shop customer, with whether their e-mail is verified. */
async function currentCustomer() {
  const session = await getAdminSession();
  if (!session?.userId || session.role !== "CUSTOMER") return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true, login: true, emailVerifiedAt: true, role: true },
  });
  const email = user?.email ?? user?.login;
  return user?.role === "CUSTOMER" && email?.includes("@") ? { email: email.toLowerCase(), verified: !!user.emailVerifiedAt } : null;
}

/** Footer form: consent now, the letter's link confirms the address. */
export async function subscribeFromForm(email: string, consent: boolean): Promise<NewsletterResult> {
  if (!consent) return { ok: false, error: "Отметьте согласие на получение рассылки" };
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const address = parsed.data;

  const before = await prisma.newsletterSubscriber.findUnique({ where: { email: address } });
  if (before?.confirmedAt && !before.unsubscribedAt) return { ok: true, message: "Этот адрес уже подписан на новости." };
  // One confirmation letter per 10 minutes for an address.
  if (before && !before.confirmedAt && Date.now() - before.updatedAt.getTime() < 10 * 60 * 1000) {
    return { ok: true, message: "Письмо для подтверждения уже отправлено — проверьте почту (и папку «Спам»)." };
  }

  const me = await currentCustomer();
  const ownVerified = me?.verified && me.email === address;
  const record = await recordConsent(address, "form", !!ownVerified);
  if (record.confirmedAt) return { ok: true, message: "Готово — вы подписаны на новости." };
  try {
    await sendConfirmationLetter(address, record.token);
  } catch (error) {
    console.error("[newsletter] confirmation letter failed", error);
    return { ok: false, error: "Не удалось отправить письмо — попробуйте позже." };
  }
  return { ok: true, message: "Мы отправили письмо — подтвердите подписку по ссылке в нём." };
}

export async function getMyNewsletter(): Promise<{ subscribed: boolean } | null> {
  const me = await currentCustomer();
  if (!me) return null;
  const record = await prisma.newsletterSubscriber.findUnique({ where: { email: me.email } });
  return { subscribed: !!record && !record.unsubscribedAt };
}

/** Checkout and Настройки: the signed-in customer's own address. */
export async function setMyNewsletter(subscribed: boolean, source: "checkout" | "account"): Promise<NewsletterResult> {
  const me = await currentCustomer();
  if (!me) return { ok: false, error: "Войдите в личный кабинет" };
  if (!subscribed) {
    await withdrawConsent(me.email);
    return { ok: true, message: "Вы отписались от новостей." };
  }
  const record = await recordConsent(me.email, source, me.verified);
  if (!record.confirmedAt) {
    await sendConfirmationLetter(me.email, record.token).catch((error) =>
      console.error("[newsletter] confirmation letter failed", error)
    );
    return { ok: true, message: "Подтвердите подписку по ссылке в письме." };
  }
  return { ok: true, message: "Вы подписаны на новости." };
}

/** The unsubscribe page's button. */
export async function unsubscribeByToken(token: string): Promise<NewsletterResult> {
  if (typeof token !== "string" || token.length < 20 || token.length > 64) return { ok: false, error: "Ссылка недействительна" };
  const record = await prisma.newsletterSubscriber.findUnique({ where: { token } });
  if (!record) return { ok: false, error: "Ссылка недействительна" };
  if (!record.unsubscribedAt) {
    await prisma.newsletterSubscriber.update({ where: { id: record.id }, data: { unsubscribedAt: new Date() } });
  }
  return { ok: true, message: `Адрес ${record.email} отписан от новостей EMV Запчасти.` };
}
