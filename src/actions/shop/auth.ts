"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createAdminSession } from "@/lib/session";

export type ActionResult = { ok: true } | { ok: false; error: string };

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
}): Promise<ActionResult> {
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
    return { ok: true };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, login: email, passwordHash, role: "CUSTOMER" },
  });
  await createAdminSession(user.id, user.role, user.login);
  return { ok: true };
}
