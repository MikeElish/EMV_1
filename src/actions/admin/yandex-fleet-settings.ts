"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-dal";
import { encryptSecret } from "@/lib/secret-box";
import { fleetRequest, YandexFleetError } from "@/lib/yandex-fleet";
import { yandexFleetSettingsSchema, type YandexFleetSettingsInput } from "@/lib/validators/yandex-fleet";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

export async function saveYandexFleetSettings(input: YandexFleetSettingsInput): Promise<ActionResult> {
  await verifyAdminSession();

  const parsed = yandexFleetSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }
  const { apiKey, parkId, clientId } = parsed.data;

  const existing = await prisma.yandexFleetSettings.findUnique({ where: { id: 1 } });
  if (!existing && !apiKey) return { ok: false, error: "Укажите API-ключ" };
  const apiKeyEnc = apiKey ? encryptSecret(apiKey) : existing!.apiKeyEnc;

  await prisma.yandexFleetSettings.upsert({
    where: { id: 1 },
    create: { id: 1, parkId, clientId: clientId.toLowerCase(), apiKeyEnc },
    update: { parkId, clientId: clientId.toLowerCase(), apiKeyEnc },
  });
  revalidatePath("/admin/settings/yandex-fleet");
  return { ok: true, message: "Сохранено" };
}

type ListResponse = { total?: number; parks?: { id: string; name?: string }[] };

/** Read-only check: counts the park's drivers and cars. */
export async function testYandexFleetConnection(): Promise<ActionResult> {
  await verifyAdminSession();
  const settings = await prisma.yandexFleetSettings.findUnique({ where: { id: 1 } });
  if (!settings) return { ok: false, error: "Сначала сохраните настройки" };

  try {
    const query = { park: { id: settings.parkId } };
    const drivers = await fleetRequest<ListResponse>("/v1/parks/driver-profiles/list", { query, limit: 1 });
    const cars = await fleetRequest<ListResponse>("/v1/parks/cars/list", { query, limit: 1 });
    const parkName = drivers.parks?.[0]?.name;
    return {
      ok: true,
      message: `Подключение установлено${parkName ? ` — парк «${parkName}»` : ""}. Водителей: ${drivers.total ?? 0}, автомобилей: ${cars.total ?? 0}.`,
    };
  } catch (error) {
    if (error instanceof YandexFleetError) return { ok: false, error: error.message };
    console.error("[yandex-fleet] test failed:", error);
    return { ok: false, error: "Не удалось проверить подключение" };
  }
}
