"use server";

import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/session";
import {
  issueEmailCode,
  hashEmailCode,
  needsEmailVerification,
  setEmailUnverifiedFlag,
  MAX_CODE_ATTEMPTS,
  RESEND_COOLDOWN_MS,
} from "@/lib/email-verification";
import { EMAIL_CODE_LENGTH } from "@/lib/email-verification-shared";

export type EmailVerificationState =
  | { required: false }
  | { required: true; email: string; sendError?: string };

async function currentCustomer() {
  const session = await getAdminSession();
  if (!session?.userId) return null;
  return prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      role: true,
      email: true,
      emailVerifiedAt: true,
      emailCodeHash: true,
      emailCodeExpiresAt: true,
      emailCodeSentAt: true,
      emailCodeAttempts: true,
    },
  });
}

/**
 * Whether the signed-in user still has to confirm their e-mail. If no code
 * was ever sent (e.g. the account was created in CRM, or the first letter
 * failed), one is sent now -- the prompt promises the code is on its way.
 */
export async function getEmailVerificationState(): Promise<EmailVerificationState> {
  const user = await currentCustomer();
  if (!user || !needsEmailVerification(user)) {
    await setEmailUnverifiedFlag(false);
    return { required: false };
  }

  await setEmailUnverifiedFlag(true);
  const issued = await issueEmailCode({ id: user.id, email: user.email! }, { onlyIfNeverSent: true });
  return { required: true, email: user.email!, ...(issued.ok ? {} : { sendError: issued.error }) };
}

export type VerifyResult = { ok: true } | { ok: false; error: string };

export async function verifyEmailCode(code: string): Promise<VerifyResult> {
  const user = await currentCustomer();
  if (!user) return { ok: false, error: "Требуется вход в аккаунт" };
  if (!needsEmailVerification(user)) {
    await setEmailUnverifiedFlag(false);
    return { ok: true };
  }

  const digits = code.replace(/\D/g, "");
  if (digits.length !== EMAIL_CODE_LENGTH) {
    return { ok: false, error: "Введите все 6 цифр кода" };
  }
  if (!user.emailCodeHash || !user.emailCodeExpiresAt) {
    return { ok: false, error: "Код не найден — нажмите «Отправить код повторно»" };
  }
  if (user.emailCodeAttempts >= MAX_CODE_ATTEMPTS) {
    return { ok: false, error: "Слишком много попыток — нажмите «Отправить код повторно»" };
  }
  if (user.emailCodeExpiresAt < new Date()) {
    return { ok: false, error: "Срок действия кода истёк — нажмите «Отправить код повторно»" };
  }

  if (hashEmailCode(user.id, digits) !== user.emailCodeHash) {
    const attempts = user.emailCodeAttempts + 1;
    await prisma.user.update({ where: { id: user.id }, data: { emailCodeAttempts: attempts } });
    return {
      ok: false,
      error:
        attempts >= MAX_CODE_ATTEMPTS
          ? "Неверный код. Попытки закончились — нажмите «Отправить код повторно»"
          : "Неверный код",
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerifiedAt: new Date(),
      emailCodeHash: null,
      emailCodeExpiresAt: null,
      emailCodeAttempts: 0,
    },
  });
  await setEmailUnverifiedFlag(false);
  return { ok: true };
}

export async function resendEmailCode(): Promise<VerifyResult> {
  const user = await currentCustomer();
  if (!user) return { ok: false, error: "Требуется вход в аккаунт" };
  if (!needsEmailVerification(user)) return { ok: true };

  if (user.emailCodeSentAt) {
    const waitMs = user.emailCodeSentAt.getTime() + RESEND_COOLDOWN_MS - Date.now();
    if (waitMs > 0) {
      return { ok: false, error: `Повторно отправить код можно через ${Math.ceil(waitMs / 1000)} с` };
    }
  }
  return issueEmailCode({ id: user.id, email: user.email! });
}
