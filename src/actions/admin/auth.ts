"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createAdminSession, deleteAdminSession } from "@/lib/session";
import { loginSchema, setupSchema } from "@/lib/validators/auth";
import type { Role } from "@prisma/client";

export type AuthResult = { ok: true; role: Role } | { ok: false; error: string };

export async function login(input: {
  identifier: string;
  password: string;
}): Promise<AuthResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ login: parsed.data.identifier }, { email: parsed.data.identifier }],
    },
  });

  if (!user) {
    return { ok: false, error: "Неверный логин или пароль" };
  }

  const passwordMatches = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!passwordMatches) {
    return { ok: false, error: "Неверный логин или пароль" };
  }

  await createAdminSession(user.id, user.role, user.login);
  return { ok: true, role: user.role };
}

export async function logout() {
  await deleteAdminSession();
  redirect("/crm");
}

export async function setupFirstAdmin(input: {
  email: string;
  password: string;
}): Promise<AuthResult | { ok: false; error: string }> {
  const existingCount = await prisma.user.count();
  if (existingCount > 0) {
    return { ok: false, error: "Владелец уже создан" };
  }

  const parsed = setupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const owner = await prisma.user.create({
    data: { email: parsed.data.email, passwordHash, login: parsed.data.email, role: "OWNER" },
  });

  await createAdminSession(owner.id, owner.role, owner.login);
  return { ok: true, role: owner.role };
}
