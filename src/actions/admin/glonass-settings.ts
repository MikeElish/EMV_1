"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-dal";
import { decryptSecret, encryptSecret } from "@/lib/secret-box";
import { glonassSettingsSchema, type GlonassSettingsInput } from "@/lib/validators/glonass";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

const GLONASS_PATH = "/admin/settings/glonass";

export async function saveGlonassSettings(input: GlonassSettingsInput): Promise<ActionResult> {
  await verifyAdminSession();

  const parsed = glonassSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }
  const { password, ...rest } = parsed.data;

  const existing = await prisma.glonassSettings.findUnique({ where: { id: 1 } });
  if (!existing && !password) {
    return { ok: false, error: "Укажите пароль" };
  }
  const passwordEnc = password ? encryptSecret(password) : existing!.passwordEnc;

  await prisma.glonassSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...rest, passwordEnc },
    update: { ...rest, passwordEnc },
  });

  revalidatePath(GLONASS_PATH);
  return { ok: true, message: "Сохранено" };
}

/**
 * Signs in to GlonassSoft with the saved credentials (API v3
 * `POST /api/v3/auth/login`) -- proves the account works before the
 * Диспетчерская map relies on it.
 */
export async function testGlonassConnection(): Promise<ActionResult> {
  await verifyAdminSession();

  const settings = await prisma.glonassSettings.findUnique({ where: { id: 1 } });
  if (!settings) return { ok: false, error: "Сначала сохраните настройки" };

  let response: Response;
  try {
    response = await fetch(`${settings.serverUrl}/api/v3/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: settings.login, password: decryptSecret(settings.passwordEnc) }),
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: `Сервер ${settings.serverUrl} не отвечает` };
  }

  const body = (await response.json().catch(() => null)) as
    | { AuthId?: string; Error?: string; User?: string }
    | null;
  if (response.ok && body?.AuthId) {
    return { ok: true, message: `Подключение установлено (пользователь ${body.User ?? settings.login})` };
  }
  return {
    ok: false,
    error: body?.Error
      ? `ГЛОНАСС отклонил вход: ${body.Error}`
      : `Не удалось войти (HTTP ${response.status})`,
  };
}
