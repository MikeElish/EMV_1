"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-dal";
import { decryptSecret, encryptSecret } from "@/lib/secret-box";
import { listOneCObjects, OneCError } from "@/lib/onec";
import { oneCSettingsSchema, ONEC_REQUIRED_OBJECTS, type OneCSettingsInput } from "@/lib/validators/onec";

export type SaveResult = { ok: true } | { ok: false; error: string };

export async function saveOneCSettings(input: OneCSettingsInput): Promise<SaveResult> {
  await verifyAdminSession();
  const parsed = oneCSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  const { password, ...rest } = parsed.data;

  const existing = await prisma.oneCSettings.findUnique({ where: { id: 1 } });
  if (!existing && !password) return { ok: false, error: "Укажите пароль" };
  const passwordEnc = password ? encryptSecret(password) : existing!.passwordEnc;

  await prisma.oneCSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...rest, passwordEnc },
    update: { ...rest, passwordEnc },
  });
  revalidatePath("/admin/settings/1c");
  return { ok: true };
}

/** Shows the stored password to the owner on request («Показать»). */
export async function revealOneCPassword(): Promise<{ ok: true; password: string } | { ok: false; error: string }> {
  await verifyAdminSession();
  const settings = await prisma.oneCSettings.findUnique({ where: { id: 1 } });
  if (!settings) return { ok: false, error: "Пароль не сохранён" };
  try {
    return { ok: true, password: decryptSecret(settings.passwordEnc) };
  } catch {
    return { ok: false, error: "Сохранённый пароль не читается — введите его заново" };
  }
}

export async function deleteOneCSettings(): Promise<SaveResult> {
  await verifyAdminSession();
  await prisma.oneCSettings.deleteMany({});
  revalidatePath("/admin/settings/1c");
  return { ok: true };
}

export type OneCCheck =
  | {
      ok: true;
      total: number;
      required: { name: string; label: string; available: boolean }[];
      other: string[];
    }
  | { ok: false; error: string };

/** Logs in and lists what the OData user can see -- read-only. */
export async function checkOneCConnection(): Promise<OneCCheck> {
  await verifyAdminSession();
  try {
    const objects = await listOneCObjects();
    const available = new Set(objects);
    const requiredNames = new Set(ONEC_REQUIRED_OBJECTS.map((o) => o.name));
    return {
      ok: true,
      total: objects.length,
      required: ONEC_REQUIRED_OBJECTS.map((o) => ({ ...o, available: available.has(o.name) })),
      other: objects.filter((o) => !requiredNames.has(o)).sort(),
    };
  } catch (error) {
    if (error instanceof OneCError) return { ok: false, error: error.message };
    console.error("[1c] check failed:", error);
    return { ok: false, error: "Не удалось проверить подключение" };
  }
}
