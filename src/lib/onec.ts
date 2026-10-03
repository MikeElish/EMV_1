import "server-only";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/secret-box";

export class OneCError extends Error {}

/** GET from the standard OData interface of 1С:Бухгалтерия (JSON). */
export async function oneCGet<T>(path: string): Promise<T> {
  const settings = await prisma.oneCSettings.findUnique({ where: { id: 1 } });
  if (!settings) throw new OneCError("Подключение не настроено: Настройки → 1С");

  const auth = Buffer.from(`${settings.login}:${decryptSecret(settings.passwordEnc)}`, "utf8").toString("base64");
  const url = `${settings.baseUrl}/odata/standard.odata${path}${path.includes("?") ? "&" : "?"}$format=json`;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    });
  } catch {
    throw new OneCError("1С не отвечает. Проверьте адрес базы и что сервис 1С:Фреш доступен.");
  }

  if (response.status === 401 || response.status === 403) {
    throw new OneCError("1С не приняла логин или пароль пользователя OData");
  }
  if (response.status === 404) {
    throw new OneCError("По этому адресу нет интерфейса OData — проверьте адрес базы");
  }
  const text = await response.text();
  if (!response.ok) {
    throw new OneCError(`1С вернула ошибку ${response.status}: ${text.replace(/\s+/g, " ").slice(0, 200)}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new OneCError("1С вернула неожиданный ответ");
  }
}

/** Names of all objects published over OData (Catalog_…, Document_…, …). */
export async function listOneCObjects(): Promise<string[]> {
  const root = await oneCGet<{ value?: { name: string }[] }>("/");
  return (root.value ?? []).map((v) => v.name);
}
