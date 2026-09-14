"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-dal";
import { userSchema, type UserInput } from "@/lib/validators/crm";
import type { Role } from "@prisma/client";

export type ActionResult = { ok: true } | { ok: false; error: string };

const LOGIN_PREFIX: Partial<Record<Role, string>> = {
  ADMIN: "adm",
  MANAGER: "m",
  SENIOR_MANAGER: "m",
  CHIEF_MANAGER: "m",
  SUPPLIER: "s",
  MECHANIC: "meh",
  DISPATCHER: "d",
  DRIVER: "v",
};

// Owner and Customer log in with their email; every other role gets a
// role-prefixed sequential code (all three manager tiers share one "m..."
// sequence, per the confirmed numbering scheme).
async function generateLogin(role: Role, email: string | undefined): Promise<string> {
  if (role === "CUSTOMER") {
    if (!email) throw new Error("Для роли «Покупатель» обязателен email — он используется как логин");
    return email;
  }

  const prefix = LOGIN_PREFIX[role];
  if (!prefix) throw new Error("Не удалось определить логин для этой роли");

  const existing = await prisma.user.findMany({
    where: { login: { startsWith: prefix } },
    select: { login: true },
  });

  let max = 0;
  for (const u of existing) {
    const suffix = u.login.slice(prefix.length);
    if (/^\d+$/.test(suffix)) {
      max = Math.max(max, parseInt(suffix, 10));
    }
  }
  return `${prefix}${max + 1}`;
}

async function assertCompanyExists(companyId: string | undefined) {
  if (!companyId) return;
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new Error("Указанная компания не найдена");
}

export async function createUser(input: UserInput): Promise<ActionResult> {
  await verifyAdminSession();

  const parsed = userSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }
  const data = parsed.data;

  if (!data.password) {
    return { ok: false, error: "Задайте пароль для нового пользователя" };
  }

  try {
    await assertCompanyExists(data.companyId);
    const login = await generateLogin(data.role, data.email || undefined);
    const passwordHash = await bcrypt.hash(data.password, 12);

    await prisma.user.create({
      data: {
        lastName: data.lastName || null,
        firstName: data.firstName || null,
        patronymic: data.patronymic || null,
        email: data.email || null,
        phone: data.phone || null,
        role: data.role,
        companyId: data.companyId || null,
        login,
        passwordHash,
      },
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  revalidatePath("/admin/crm/users");
  redirect("/admin/crm/users");
}

export async function updateUser(id: string, input: UserInput): Promise<ActionResult> {
  await verifyAdminSession();

  const parsed = userSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }
  const data = parsed.data;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return { ok: false, error: "Пользователь не найден" };
  }
  if (existing.role === "OWNER") {
    return { ok: false, error: "Роль владельца нельзя изменить через эту форму" };
  }

  try {
    await assertCompanyExists(data.companyId);

    await prisma.user.update({
      where: { id },
      data: {
        lastName: data.lastName || null,
        firstName: data.firstName || null,
        patronymic: data.patronymic || null,
        email: data.email || null,
        phone: data.phone || null,
        role: data.role,
        companyId: data.companyId || null,
        ...(data.password ? { passwordHash: await bcrypt.hash(data.password, 12) } : {}),
      },
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  revalidatePath("/admin/crm/users");
  redirect("/admin/crm/users");
}

export async function deleteUser(id: string): Promise<ActionResult> {
  await verifyAdminSession();

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return { ok: true };
  if (existing.role === "OWNER") {
    return { ok: false, error: "Нельзя удалить владельца" };
  }

  await prisma.user.delete({ where: { id } });
  revalidatePath("/admin/crm/users");
  return { ok: true };
}
