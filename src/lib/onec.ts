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

/**
 * Writes to 1С (POST creates, PATCH changes, POST …/Post() posts a document).
 * 1С's own message comes back in the error, so the employee sees why 1С
 * refused (e.g. what is missing for posting).
 */
export async function oneCSend<T>(method: "POST" | "PATCH", path: string, body?: unknown): Promise<T> {
  const settings = await prisma.oneCSettings.findUnique({ where: { id: 1 } });
  if (!settings) throw new OneCError("Подключение не настроено: Настройки → 1С");
  const auth = Buffer.from(`${settings.login}:${decryptSecret(settings.passwordEnc)}`, "utf8").toString("base64");
  const url = `${settings.baseUrl}/odata/standard.odata${path}${path.includes("?") ? "&" : "?"}$format=json`;
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json", "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
      cache: "no-store",
    });
  } catch {
    throw new OneCError("1С не отвечает. Попробуйте ещё раз.");
  }
  const text = await response.text();
  if (response.status === 401 || response.status === 403) {
    throw new OneCError("1С не разрешает пользователю OData запись — дайте ему права на изменение");
  }
  if (!response.ok) {
    let message = text.replace(/\s+/g, " ").slice(0, 300);
    try {
      message = JSON.parse(text)["odata.error"]?.message?.value ?? message;
    } catch {
      // not JSON
    }
    throw new OneCError(`1С: ${message}`);
  }
  try {
    return (text ? JSON.parse(text) : {}) as T;
  } catch {
    return {} as T;
  }
}

/**
 * Every row of a catalog/document set, paged ($top/$skip), with the given
 * $select. Pages are ordered by Ref_Key: without $orderby 1С returns pages
 * in no stable order, so rows repeat across pages while others are skipped.
 */
export async function oneCGetAll<T extends { Ref_Key: string }>(entitySet: string, select: string[]): Promise<T[]> {
  const byRef = new Map<string, T>();
  const page = 500;
  for (let skip = 0; ; skip += page) {
    const res = await oneCGet<{ value?: T[] }>(
      `/${encodeURIComponent(entitySet)}?$select=${select.join(",")}&$orderby=Ref_Key&$top=${page}&$skip=${skip}`
    );
    const rows = res.value ?? [];
    for (const row of rows) byRef.set(row.Ref_Key, row);
    if (rows.length < page) break;
  }
  return [...byRef.values()];
}

/** Names of all objects published over OData (Catalog_…, Document_…, …). */
export async function listOneCObjects(): Promise<string[]> {
  const root = await oneCGet<{ value?: { name: string }[] }>("/");
  return (root.value ?? []).map((v) => v.name);
}
