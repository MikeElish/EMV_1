"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  saveYandexFleetSettings,
  testYandexFleetConnection,
  type ActionResult,
} from "@/actions/admin/yandex-fleet-settings";
import { DEFAULT_YANDEX_PARK_ID, extractParkId } from "@/lib/validators/yandex-fleet";

const inputClassName =
  "mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50";

export function YandexFleetSettingsForm({
  initial,
}: {
  initial: { parkId: string; clientId: string; updatedAt: string } | null;
}) {
  const router = useRouter();
  const [parkId, setParkId] = useState(initial?.parkId ?? DEFAULT_YANDEX_PARK_ID);
  const [clientId, setClientId] = useState(initial?.clientId ?? `taxi/park/${DEFAULT_YANDEX_PARK_ID}`);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const saved = await saveYandexFleetSettings({
      parkId,
      clientId,
      apiKey: String(form.get("apiKey") ?? ""),
    });
    setSaving(false);
    if (!saved.ok) {
      setResult(saved);
      return;
    }
    (event.target as HTMLFormElement).querySelector<HTMLInputElement>("#fleetApiKey")!.value = "";
    router.refresh();
    // Check right away -- a wrong key is the usual first-time mistake.
    setTesting(true);
    setResult(await testYandexFleetConnection());
    setTesting(false);
  }

  async function handleTest() {
    setResult(null);
    setTesting(true);
    setResult(await testYandexFleetConnection());
    setTesting(false);
  }

  return (
    <div>
      <h1 className="text-lg font-semibold">Яндекс.Флот</h1>
      <p className="mt-1 max-w-xl text-sm text-foreground/60">
        Подключение к кабинету парка fleet.yandex.ru через Fleet API. Ключ хранится в зашифрованном
        виде и не показывается.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 max-w-xl space-y-4">
        <div>
          <label htmlFor="fleetParkId" className="text-sm text-foreground/60">
            Идентификатор партнёра (park_id)
          </label>
          <input
            id="fleetParkId"
            required
            value={parkId}
            onChange={(e) => {
              // A pasted cabinet link is reduced to its park_id; Client ID follows.
              const next = extractParkId(e.target.value);
              if (clientId === `taxi/park/${parkId}`) setClientId(`taxi/park/${next}`);
              setParkId(next);
            }}
            placeholder="или вставьте ссылку на кабинет с park_id=…"
            className={inputClassName}
          />
        </div>
        <div>
          <label htmlFor="fleetClientId" className="text-sm text-foreground/60">
            Идентификатор клиента (X-Client-ID)
          </label>
          <input
            id="fleetClientId"
            required
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className={inputClassName}
          />
        </div>
        <div>
          <label htmlFor="fleetApiKey" className="text-sm text-foreground/60">
            Секретный API-ключ (X-API-Key)
          </label>
          <input
            id="fleetApiKey"
            name="apiKey"
            type="password"
            autoComplete="off"
            required={!initial}
            placeholder={initial ? "•••••••• (сохранён)" : ""}
            className={inputClassName}
          />
          {initial && <p className="mt-1 text-xs text-foreground/40">Оставьте пустым, чтобы не менять.</p>}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving || testing}
            className="rounded-md bg-foreground px-6 py-2 font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Сохраняем..." : "Сохранить"}
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || saving || !initial}
            title={initial ? undefined : "Сначала сохраните настройки"}
            className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {testing ? "Проверяем..." : "Проверить подключение"}
          </button>
        </div>

        {result &&
          (result.ok ? (
            <p className="text-sm text-green-600">{result.message}</p>
          ) : (
            <p className="text-sm text-red-600">{result.error}</p>
          ))}
        {initial && (
          <p className="text-xs text-foreground/40">
            Изменено: {new Date(initial.updatedAt).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}
          </p>
        )}
      </form>

      <div className="mt-8 max-w-xl rounded-lg border border-foreground/10 p-4 text-sm">
        <p className="font-medium">Где взять данные</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-foreground/70">
          <li>Войдите в Диспетчерскую fleet.yandex.ru сотрудником с ролью «Директор».</li>
          <li>Откройте «Настройки → API».</li>
          <li>
            Перенесите сюда три значения: идентификатор партнёра (park_id), идентификатор клиента
            (X-Client-ID) и секретный API-ключ (X-API-Key).
          </li>
          <li>
            Если при создании ключа предлагают выбрать права — отметьте водителей, автомобили, заказы и
            транзакции. Для проверки подключения достаточно чтения водителей и автомобилей.
          </li>
        </ol>
      </div>
    </div>
  );
}
