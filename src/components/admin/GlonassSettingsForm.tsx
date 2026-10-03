"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  saveGlonassSettings,
  testGlonassConnection,
  type ActionResult,
} from "@/actions/admin/glonass-settings";
import { GLONASS_DEFAULT_SERVER } from "@/lib/validators/glonass";

const inputClassName =
  "w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50";

export function GlonassSettingsForm({
  initial,
}: {
  initial: { serverUrl: string; login: string; hasPassword: boolean; updatedAt: string } | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const saved = await saveGlonassSettings({
      serverUrl: String(form.get("serverUrl") ?? ""),
      login: String(form.get("login") ?? ""),
      password: String(form.get("password") ?? ""),
    });
    setSaving(false);
    setResult(saved);
    if (saved.ok) {
      (event.target as HTMLFormElement).reset();
      router.refresh();
    }
  }

  async function handleTest() {
    setResult(null);
    setTesting(true);
    setResult(await testGlonassConnection());
    setTesting(false);
  }

  return (
    <div>
      <h1 className="text-lg font-semibold">ГЛОНАСС</h1>
      <p className="mt-1 max-w-xl text-sm text-foreground/60">
        Учётная запись мониторинга GlonassSoft, карта которой выводится в разделе Таксопарк →
        Диспетчерская. Пароль хранится в зашифрованном виде и не показывается.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 max-w-xl space-y-4">
        <div>
          <label htmlFor="serverUrl" className="text-sm text-foreground/60">
            Адрес сервера
          </label>
          <input
            id="serverUrl"
            name="serverUrl"
            type="url"
            required
            defaultValue={initial?.serverUrl ?? GLONASS_DEFAULT_SERVER}
            className={`mt-1 ${inputClassName}`}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="glonassLogin" className="text-sm text-foreground/60">
              Логин
            </label>
            <input
              id="glonassLogin"
              name="login"
              required
              autoComplete="off"
              defaultValue={initial?.login}
              className={`mt-1 ${inputClassName}`}
            />
          </div>
          <div>
            <label htmlFor="glonassPassword" className="text-sm text-foreground/60">
              Пароль
            </label>
            <input
              id="glonassPassword"
              name="password"
              type="password"
              autoComplete="new-password"
              required={!initial?.hasPassword}
              placeholder={initial?.hasPassword ? "•••••••• (сохранён)" : ""}
              className={`mt-1 ${inputClassName}`}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-foreground px-6 py-2 font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Сохраняем..." : "Сохранить"}
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || !initial}
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
            Изменено: {new Date(initial.updatedAt).toLocaleString("ru-RU")}
          </p>
        )}
      </form>
    </div>
  );
}
