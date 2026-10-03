import "server-only";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/secret-box";

const API_BASE = "https://fleet-api.taxi.yandex.net";

export class YandexFleetError extends Error {}

/**
 * One call to the Yandex Fleet API with the park's credentials from
 * Настройки → Яндекс.Флот (X-Client-ID + X-API-Key headers).
 */
export async function fleetRequest<T>(path: string, body: unknown): Promise<T> {
  const settings = await prisma.yandexFleetSettings.findUnique({ where: { id: 1 } });
  if (!settings) throw new YandexFleetError("Подключение не настроено: Настройки → Яндекс.Флот");

  let response: Response;
  try {
    response = await fetch(API_BASE + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept-Language": "ru",
        "X-Client-ID": settings.clientId,
        "X-API-Key": decryptSecret(settings.apiKeyEnc),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });
  } catch {
    throw new YandexFleetError("Сервер Яндекс.Флота не отвечает");
  }

  const data = (await response.json().catch(() => null)) as (T & { message?: string }) | null;
  if (response.ok && data) return data;
  if (response.status === 401 || response.status === 403) {
    throw new YandexFleetError(
      "Яндекс.Флот отклонил ключ: проверьте Client ID и API-ключ, и что у ключа есть нужные права"
    );
  }
  if (response.status === 429) throw new YandexFleetError("Слишком много запросов к Яндекс.Флоту — повторите через минуту");
  throw new YandexFleetError(`Яндекс.Флот вернул ошибку ${response.status}${data?.message ? `: ${data.message}` : ""}`);
}

export async function getParkId() {
  const settings = await prisma.yandexFleetSettings.findUnique({ where: { id: 1 }, select: { parkId: true } });
  return settings?.parkId ?? null;
}
