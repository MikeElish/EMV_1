"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAdminSession, createAdminSession, deleteAdminSession } from "@/lib/session";
import {
  customerSettingsSchema,
  type CustomerSettingsInput,
} from "@/lib/validators/customer-settings";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type MyProfile = {
  lastName: string | null;
  firstName: string | null;
  email: string | null;
  companyName: string | null;
  deliveryMethod: string | null;
  settlement: string | null;
  street: string | null;
  house: string | null;
  apartment: string | null;
  terminal: string | null;
};

export async function getMyProfile(): Promise<MyProfile | null> {
  const session = await getAdminSession();
  if (!session?.userId || session.role !== "CUSTOMER") return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { company: { select: { name: true } } },
  });
  if (!user) return null;

  return {
    lastName: user.lastName,
    firstName: user.firstName,
    email: user.email,
    companyName: user.company?.name ?? null,
    deliveryMethod: user.defaultDeliveryMethod,
    settlement: user.defaultSettlement,
    street: user.defaultStreet,
    house: user.defaultHouse,
    apartment: user.defaultApartment,
    terminal: user.defaultTerminal,
  };
}

export async function updateMyProfile(input: CustomerSettingsInput): Promise<ActionResult> {
  const session = await getAdminSession();
  if (!session?.userId || session.role !== "CUSTOMER") {
    return { ok: false, error: "Требуется вход в аккаунт" };
  }

  const parsed = customerSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }
  const data = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) {
    return { ok: false, error: "Пользователь не найден" };
  }

  let passwordHash: string | undefined;
  if (data.newPassword) {
    const matches = await bcrypt.compare(data.currentPassword ?? "", user.passwordHash);
    if (!matches) {
      return { ok: false, error: "Текущий пароль указан неверно" };
    }
    passwordHash = await bcrypt.hash(data.newPassword, 12);
  }

  const emailChanged = data.email !== user.email;
  if (emailChanged) {
    const conflict = await prisma.user.findFirst({
      where: { OR: [{ email: data.email }, { login: data.email }], NOT: { id: user.id } },
    });
    if (conflict) {
      return { ok: false, error: "Этот email уже используется" };
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastName: data.lastName || null,
      firstName: data.firstName || null,
      email: data.email,
      ...(emailChanged ? { login: data.email } : {}),
      ...(passwordHash ? { passwordHash } : {}),
      defaultDeliveryMethod: data.deliveryMethod ?? null,
      defaultSettlement: data.settlement || null,
      defaultStreet: data.street || null,
      defaultHouse: data.house || null,
      defaultApartment: data.apartment || null,
      defaultTerminal: data.terminal || null,
    },
  });

  if (emailChanged) {
    // Re-issue the session so the header badge (which reads the login off
    // the JWT) reflects the new address immediately, not the stale one.
    await createAdminSession(user.id, user.role, data.email);
  }

  revalidatePath("/shop/orders");
  return { ok: true };
}

export async function logoutCustomer(): Promise<{ ok: true }> {
  await deleteAdminSession();
  return { ok: true };
}
