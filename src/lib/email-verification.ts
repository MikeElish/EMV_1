import "server-only";
import { createHash, randomInt } from "crypto";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sendSiteMail } from "@/lib/mailer";
import { EMAIL_UNVERIFIED_COOKIE } from "@/lib/email-verification-shared";

export const CODE_TTL_MS = 15 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 60 * 1000;
export const MAX_CODE_ATTEMPTS = 5;

export function hashEmailCode(userId: string, code: string) {
  return createHash("sha256").update(`${userId}:${code}`).digest("hex");
}

export type IssueResult = { ok: true } | { ok: false; error: string };

/**
 * Generates a fresh code, stores its hash and mails it. With `onlyIfNeverSent`
 * the code is issued only when none has been sent yet -- the claim is a
 * conditional update, so two prompts loading at once can't send two letters.
 */
export async function issueEmailCode(
  user: { id: string; email: string },
  { onlyIfNeverSent = false }: { onlyIfNeverSent?: boolean } = {}
): Promise<IssueResult> {
  const code = String(randomInt(0, 10 ** 6)).padStart(6, "0");
  const now = new Date();

  const claimed = await prisma.user.updateMany({
    where: { id: user.id, ...(onlyIfNeverSent ? { emailCodeSentAt: null } : {}) },
    data: {
      emailCodeHash: hashEmailCode(user.id, code),
      emailCodeExpiresAt: new Date(now.getTime() + CODE_TTL_MS),
      emailCodeSentAt: now,
      emailCodeAttempts: 0,
    },
  });
  if (claimed.count === 0) return { ok: true };

  try {
    await sendSiteMail({
      to: user.email,
      subject: `Код подтверждения: ${code}`,
      text: [
        "Здравствуйте!",
        "",
        `Ваш код подтверждения электронной почты на сайте emv.one: ${code}`,
        "Код действует 15 минут.",
        "",
        "Если вы не регистрировались на сайте emv.one, просто проигнорируйте это письмо.",
      ].join("\n"),
      html: `<div style="font-family:Arial,sans-serif;font-size:15px;color:#111">
  <p>Здравствуйте!</p>
  <p>Ваш код подтверждения электронной почты на сайте emv.one:</p>
  <p style="font-size:30px;font-weight:bold;letter-spacing:8px;margin:16px 0">${code}</p>
  <p>Код действует 15 минут.</p>
  <p style="color:#777;font-size:13px">Если вы не регистрировались на сайте emv.one, просто проигнорируйте это письмо.</p>
</div>`,
    });
  } catch (error) {
    console.error("[email-verification] send failed:", error);
    // Roll back so the next attempt isn't blocked by the resend cooldown.
    await prisma.user.update({
      where: { id: user.id },
      data: { emailCodeHash: null, emailCodeExpiresAt: null, emailCodeSentAt: null },
    });
    return { ok: false, error: "Не удалось отправить письмо с кодом. Попробуйте ещё раз позже." };
  }
  return { ok: true };
}

export async function setEmailUnverifiedFlag(pending: boolean) {
  const cookieStore = await cookies();
  // Writing a cookie from a server action makes the client router refresh
  // the page, so leave it alone when it already says the right thing.
  const current = cookieStore.get(EMAIL_UNVERIFIED_COOKIE)?.value === "1";
  if (current === pending) return;
  if (!pending) {
    cookieStore.delete(EMAIL_UNVERIFIED_COOKIE);
    return;
  }
  const headersList = await headers();
  cookieStore.set(EMAIL_UNVERIFIED_COOKIE, "1", {
    httpOnly: false,
    secure: headersList.get("x-forwarded-proto") === "https",
    sameSite: "lax",
    path: "/",
    maxAge: 90 * 24 * 60 * 60,
  });
}

/** Only customers confirm their address; staff accounts are never asked. */
export function needsEmailVerification(user: {
  role: string;
  email: string | null;
  emailVerifiedAt: Date | null;
}) {
  return user.role === "CUSTOMER" && !!user.email && !user.emailVerifiedAt;
}
