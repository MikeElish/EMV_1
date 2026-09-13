"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createAdminSession, deleteAdminSession } from "@/lib/session";
import { loginSchema, setupSchema } from "@/lib/validators/auth";

export type AuthResult = { ok: true } | { ok: false; error: string };

export async function login(input: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  const admin = await prisma.adminUser.findUnique({
    where: { email: parsed.data.email },
  });

  if (!admin) {
    return { ok: false, error: "Неверный email или пароль" };
  }

  const passwordMatches = await bcrypt.compare(
    parsed.data.password,
    admin.passwordHash
  );
  if (!passwordMatches) {
    return { ok: false, error: "Неверный email или пароль" };
  }

  await createAdminSession(admin.id);
  return { ok: true };
}

export async function logout() {
  await deleteAdminSession();
  redirect("/admin/login");
}

export async function setupFirstAdmin(input: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  const existingCount = await prisma.adminUser.count();
  if (existingCount > 0) {
    return { ok: false, error: "Администратор уже создан" };
  }

  const parsed = setupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const admin = await prisma.adminUser.create({
    data: { email: parsed.data.email, passwordHash },
  });

  await createAdminSession(admin.id);
  return { ok: true };
}
