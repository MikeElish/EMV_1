import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sendSiteMail } from "@/lib/mailer";
import { absoluteUrl } from "@/lib/site";

// Рассылка: consent is kept with its date, source and IP (38-ФЗ ст. 18 —
// the shop has to prove it). An address is mailed only once it is the
// subscriber's own: a verified shop account, or the link of the
// confirmation letter. Every letter carries the unsubscribe link.

export type NewsletterSource = "register" | "checkout" | "account" | "form" | "invite";

export const NEWSLETTER_SOURCE_LABELS: Record<string, string> = {
  register: "Регистрация",
  checkout: "Оформление заказа",
  invite: "Приглашение по e-mail",
  account: "Личный кабинет",
  form: "Форма на сайте",
};

export const confirmUrl = (token: string) => absoluteUrl(`/shop/newsletter/confirm?t=${token}`);
export const unsubscribeUrl = (token: string) => absoluteUrl(`/shop/newsletter/unsubscribe?t=${token}`);
/** For the List-Unsubscribe-Post header (one click in the mail app, RFC 8058). */
export const oneClickUnsubscribeUrl = (token: string) => absoluteUrl(`/shop/newsletter/unsubscribe/one-click?t=${token}`);

async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim() || null;
}

/**
 * Records the consent (again, if it was withdrawn). `confirmed`: the address
 * is known to be the subscriber's. Returns the record.
 */
export async function recordConsent(email: string, source: NewsletterSource, confirmed: boolean) {
  const address = email.trim().toLowerCase();
  const now = new Date();
  const consentIp = await clientIp();
  const existing = await prisma.newsletterSubscriber.findUnique({ where: { email: address } });
  if (existing) {
    return prisma.newsletterSubscriber.update({
      where: { id: existing.id },
      data: {
        source,
        consentAt: now,
        consentIp,
        unsubscribedAt: null,
        confirmedAt: existing.confirmedAt ?? (confirmed ? now : null),
      },
    });
  }
  return prisma.newsletterSubscriber.create({
    data: {
      email: address,
      source,
      consentIp,
      confirmedAt: confirmed ? now : null,
      token: randomBytes(24).toString("base64url"),
    },
  });
}

/** The customer verified their e-mail with the code: a pending consent of theirs is confirmed. */
export async function confirmSubscriberEmail(email: string) {
  await prisma.newsletterSubscriber.updateMany({
    where: { email: email.trim().toLowerCase(), confirmedAt: null },
    data: { confirmedAt: new Date() },
  });
}

export async function withdrawConsent(email: string) {
  await prisma.newsletterSubscriber.updateMany({
    where: { email: email.trim().toLowerCase(), unsubscribedAt: null },
    data: { unsubscribedAt: new Date() },
  });
}

// ---- Приглашения ----------------------------------------------------------

/** Personal letters from the site's mailbox: few a day keep it out of spam. */
export const INVITES_PER_DAY = 30;

/** Signs an address so only the invited one can subscribe it by the link. */
function inviteSignature(email: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return createHmac("sha256", `newsletter-invite:${secret}`).update(email.toLowerCase()).digest("base64url").slice(0, 32);
}

export function checkInviteSignature(email: string, signature: string) {
  const expected = Buffer.from(inviteSignature(email));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export const joinUrl = (email: string) =>
  absoluteUrl(`/shop/newsletter/join?e=${encodeURIComponent(email)}&s=${inviteSignature(email)}`);

/**
 * A personal letter asking for the consent -- it advertises nothing itself,
 * so it may go to a client who hasn't agreed yet.
 */
export async function sendInviteLetter(email: string, name: string | null) {
  const link = joinUrl(email);
  const hello = name ? `Здравствуйте, ${name}!` : "Здравствуйте!";
  await sendSiteMail({
    to: email,
    subject: "EMV Запчасти: наличие на складе и ваши цены на сайте",
    text: `${hello}

Мы обновили сайт emv.one: теперь там видно, что есть на нашем складе, а после входа — ваши цены и история заказов.

Если хотите узнавать о поступлениях запчастей и специальных предложениях, подпишитесь на новости: ${link}

Если не хотите — ничего делать не нужно, писем с новостями не будет.`,
    html: `<div style="font-family:Arial,sans-serif;font-size:15px;color:#111;line-height:1.5">
<p>${hello.replace(/</g, "&lt;")}</p>
<p>Мы обновили сайт <a href="https://emv.one" style="color:#111">emv.one</a>: теперь там видно, что есть на нашем складе, а после входа — ваши цены и история заказов.</p>
<p>Если хотите узнавать о поступлениях запчастей и специальных предложениях, подпишитесь на новости:</p>
<p><a href="${link}" style="display:inline-block;background:#111;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Подписаться на новости</a></p>
<p style="color:#555;font-size:13px">Если не хотите — ничего делать не нужно, писем с новостями не будет.</p>
</div>`,
  });
}

export async function sendConfirmationLetter(email: string, token: string) {
  const link = confirmUrl(token);
  await sendSiteMail({
    to: email,
    subject: "Подтвердите подписку на новости EMV Запчасти",
    text: `Здравствуйте!

Этот адрес указали для подписки на новости EMV Запчасти: поступления запчастей на склад и специальные предложения.

Подтвердить подписку: ${link}

Если вы не подписывались, просто не отвечайте на это письмо — мы ничего не будем присылать.`,
    html: `<div style="font-family:Arial,sans-serif;font-size:15px;color:#111;line-height:1.5">
<p>Здравствуйте!</p>
<p>Этот адрес указали для подписки на новости EMV Запчасти: поступления запчастей на склад и специальные предложения.</p>
<p><a href="${link}" style="display:inline-block;background:#111;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Подтвердить подписку</a></p>
<p style="color:#555;font-size:13px">Если вы не подписывались, просто не отвечайте на это письмо — мы ничего не будем присылать.</p>
</div>`,
  });
}
