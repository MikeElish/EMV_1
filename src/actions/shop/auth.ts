"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createAdminSession } from "@/lib/session";
import { issueEmailCode, needsEmailVerification, setEmailUnverifiedFlag } from "@/lib/email-verification";
import { setConsentPendingFlag } from "@/lib/personal-data-consent";
import { formatRuPhone } from "@/lib/phone";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type CustomerAuthResult =
  | { ok: true; emailVerified: boolean; sendError?: string }
  | { ok: false; error: string };

/**
 * Used by checkout to decide the password modal's label ("Введите пароль"
 * vs "Новый пароль") before the shopper commits to a password. Only ever
 * reports true for an existing CUSTOMER account -- a staff/admin email
 * match is treated as "doesn't exist" here so this can't be used to probe
 * which emails have CRM accounts.
 */
export async function checkCustomerEmailExists(email: string): Promise<{ exists: boolean }> {
  const trimmed = email.trim();
  if (!trimmed) return { exists: false };
  const user = await prisma.user.findUnique({ where: { email: trimmed }, select: { role: true } });
  return { exists: user?.role === "CUSTOMER" };
}

/**
 * Logs an existing customer in, or registers a brand-new customer account,
 * from the checkout page's password modal -- then signs them in either way,
 * so the checkout's own createOrder() picks up the session and links the
 * order to the account.
 */
export async function registerOrLoginCustomer(input: {
  email: string;
  password: string;
  /** «Согласие на обработку персональных данных» ticked in the form. */
  personalDataConsent?: boolean;
}): Promise<CustomerAuthResult> {
  const email = input.email.trim();
  const password = input.password;

  if (!email) {
    return { ok: false, error: "Укажите email" };
  }
  if (!password || password.length < 6) {
    return { ok: false, error: "Пароль должен быть не короче 6 символов" };
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    if (existing.role !== "CUSTOMER") {
      return {
        ok: false,
        error: "Этот email уже используется, направьте запрос на info@emv.one",
      };
    }
    const matches = await bcrypt.compare(password, existing.passwordHash);
    if (!matches) {
      return { ok: false, error: "Неверный пароль" };
    }
    await createAdminSession(existing.id, existing.role, existing.login);
    let consentAt = existing.personalDataConsentAt;
    if (!consentAt && input.personalDataConsent) {
      consentAt = new Date();
      await prisma.user.update({ where: { id: existing.id }, data: { personalDataConsentAt: consentAt } });
    }
    await setConsentPendingFlag(!consentAt);
    if (!needsEmailVerification(existing)) {
      await setEmailUnverifiedFlag(false);
      return { ok: true, emailVerified: true };
    }
    await setEmailUnverifiedFlag(true);
    const issued = await issueEmailCode({ id: existing.id, email }, { onlyIfNeverSent: true });
    return { ok: true, emailVerified: false, ...(issued.ok ? {} : { sendError: issued.error }) };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      login: email,
      passwordHash,
      role: "CUSTOMER",
      personalDataConsentAt: input.personalDataConsent ? new Date() : null,
    },
  });
  await setConsentPendingFlag(!input.personalDataConsent);
  await createAdminSession(user.id, user.role, user.login);
  // A new account must confirm its e-mail before ordering: the 6-digit code
  // goes out right away.
  await setEmailUnverifiedFlag(true);
  const issued = await issueEmailCode({ id: user.id, email });
  return { ok: true, emailVerified: false, ...(issued.ok ? {} : { sendError: issued.error }) };
}

/**
 * «Регистрация» on the sign-in page (/crm/register): a new Покупатель with
 * name and phone, signed in right away -- then the same way as any signed-in
 * customer (e-mail code, «Мои заказы»).
 */
export async function registerCustomer(input: {
  lastName: string;
  firstName: string;
  phone: string;
  email: string;
  password: string;
  personalDataConsent: boolean;
}): Promise<CustomerAuthResult> {
  const lastName = input.lastName.trim();
  const firstName = input.firstName.trim();
  const email = input.email.trim();
  const phoneDigits = input.phone.replace(/\D/g, "").replace(/^[78]/, "");

  if (!lastName || !firstName) return { ok: false, error: "Укажите фамилию и имя" };
  if (lastName.length > 100 || firstName.length > 100) return { ok: false, error: "Слишком длинное имя" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Укажите корректный email" };
  if (phoneDigits.length !== 10) return { ok: false, error: "Укажите телефон полностью" };
  if (!input.password || input.password.length < 6) return { ok: false, error: "Пароль должен быть не короче 6 символов" };
  if (input.password.length > 200) return { ok: false, error: "Слишком длинный пароль" };
  if (!input.personalDataConsent) return { ok: false, error: "Нужно согласие на обработку персональных данных" };

  const taken = await prisma.user.findFirst({ where: { OR: [{ email }, { login: email }] }, select: { role: true } });
  if (taken) {
    return {
      ok: false,
      error:
        taken.role === "CUSTOMER"
          ? "Этот email уже зарегистрирован — войдите с паролем"
          : "Этот email уже используется, направьте запрос на info@emv.one",
    };
  }

  const user = await prisma.user.create({
    data: {
      email,
      login: email,
      passwordHash: await bcrypt.hash(input.password, 12),
      role: "CUSTOMER",
      lastName,
      firstName,
      phone: formatRuPhone(phoneDigits),
      personalDataConsentAt: new Date(),
    },
  });
  await createAdminSession(user.id, user.role, user.login);
  await setConsentPendingFlag(false);
  await setEmailUnverifiedFlag(true);
  const issued = await issueEmailCode({ id: user.id, email });
  return { ok: true, emailVerified: false, ...(issued.ok ? {} : { sendError: issued.error }) };
}
