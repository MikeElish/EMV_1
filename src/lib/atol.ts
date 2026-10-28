import "server-only";
import type { CashboxSettings } from "@prisma/client";
import { decryptSecret } from "@/lib/secret-box";

// АТОЛ Онлайн, protocol v5 (ФФД 1.2): a token for 24 hours, a receipt sent to
// <group>/<operation>, its result read from <group>/report/<uuid>.

const ATOL = "https://online.atol.ru/possystem/v5";

export class AtolError extends Error {}

type AtolAnswer = { error?: { code?: number; text?: string } | null };

const cache = globalThis as unknown as { __emvAtolToken?: { key: string; token: string; until: number } };

async function call<T extends AtolAnswer>(path: string, init: { method: "GET" | "POST"; token?: string; body?: unknown }): Promise<T> {
  const response = await fetch(`${ATOL}${path}`, {
    method: init.method,
    headers: { "Content-Type": "application/json; charset=utf-8", ...(init.token ? { Token: init.token } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  }).catch(() => {
    throw new AtolError("АТОЛ Онлайн не ответил");
  });
  const json = (await response.json().catch(() => null)) as T | null;
  if (!json) throw new AtolError(`АТОЛ Онлайн ответил ${response.status}`);
  if (json.error) throw new AtolError(`АТОЛ Онлайн: ${json.error.text ?? "ошибка"}${json.error.code ? ` (код ${json.error.code})` : ""}`);
  return json;
}

/** A token of the settings' account, kept for 23 hours. */
export async function atolToken(settings: CashboxSettings): Promise<string> {
  if (!settings.atolLogin || !settings.atolPasswordEnc) throw new AtolError("Не заданы логин и пароль АТОЛ Онлайн");
  const key = `${settings.atolLogin}:${settings.atolPasswordEnc}`;
  const kept = cache.__emvAtolToken;
  if (kept && kept.key === key && kept.until > Date.now()) return kept.token;
  const { token } = await call<AtolAnswer & { token: string }>("/getToken", {
    method: "POST",
    body: { login: settings.atolLogin, pass: decryptSecret(settings.atolPasswordEnc) },
  });
  cache.__emvAtolToken = { key, token, until: Date.now() + 23 * 60 * 60 * 1000 };
  return token;
}

export type AtolItem = {
  name: string;
  /** Rubles. */
  price: number;
  quantity: number;
  sum: number;
  measure: 0;
  payment_method: "full_prepayment" | "full_payment";
  /** 1 -- товар. */
  payment_object: 1;
  vat: { type: string };
};

export type AtolReceipt = {
  client: { email?: string; phone?: string };
  company: { email: string; sno: string; inn: string; payment_address: string };
  items: AtolItem[];
  /** 1 -- безналичный, 2 -- зачёт предоплаты. */
  payments: { type: 1 | 2; sum: number }[];
  total: number;
};

/** «dd.mm.yyyy HH:MM:SS», Moscow time. */
function timestamp(date: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
      .formatToParts(date)
      .map((x) => [x.type, x.value])
  );
  return `${p.day}.${p.month}.${p.year} ${p.hour}:${p.minute}:${p.second}`;
}

/** Sends «Приход» (sell); returns АТОЛ's uuid of the document. */
export async function atolSell(settings: CashboxSettings, externalId: string, receipt: AtolReceipt): Promise<string> {
  if (!settings.atolGroupCode) throw new AtolError("Не задан код группы касс АТОЛ Онлайн");
  const token = await atolToken(settings);
  const { uuid } = await call<AtolAnswer & { uuid: string }>(`/${encodeURIComponent(settings.atolGroupCode)}/sell`, {
    method: "POST",
    token,
    body: { timestamp: timestamp(new Date()), external_id: externalId, receipt },
  });
  return uuid;
}

export type AtolReport = { status: "wait" | "done" | "fail"; payload?: Record<string, unknown> | null; error?: string };

/** The result of a document sent before. */
export async function atolReport(settings: CashboxSettings, uuid: string): Promise<AtolReport> {
  const token = await atolToken(settings);
  try {
    const r = await call<AtolAnswer & { status: AtolReport["status"]; payload?: Record<string, unknown> | null }>(
      `/${encodeURIComponent(settings.atolGroupCode)}/report/${encodeURIComponent(uuid)}`,
      { method: "GET", token }
    );
    return { status: r.status, payload: r.payload };
  } catch (error) {
    // A failed receipt comes back with its error.
    return { status: "fail", error: (error as Error).message };
  }
}
