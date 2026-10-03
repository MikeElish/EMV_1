"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  checkOneCConnection,
  deleteOneCSettings,
  revealOneCPassword,
  saveOneCSettings,
  type OneCCheck,
} from "@/actions/admin/onec-settings";

const inputClassName =
  "mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50";

type Saved = { baseUrl: string; login: string; updatedAt: string } | null;

function CheckResult({ check }: { check: OneCCheck }) {
  if (!check.ok) return <p className="text-sm text-red-600">{check.error}</p>;
  const missing = check.required.filter((r) => !r.available).length;
  return (
    <div className="space-y-3">
      {check.total === 0 ? (
        <p className="text-sm text-amber-700">
          Вход выполнен, но 1С не открыла сайту ни одного объекта. В «Бухгалтерии»: Администрирование →
          Синхронизация данных → «Настройка стандартного интерфейса OData» — отметьте справочники и документы
          из списка ниже и сохраните.
        </p>
      ) : (
        <p className={`text-sm ${missing ? "text-amber-700" : "text-green-600"}`}>
          Подключение работает. Доступно объектов: {check.total}
          {missing ? `, из нужных сайту не хватает: ${missing}` : ", все нужные сайту — открыты"}.
        </p>
      )}
      <ul className="space-y-1 text-sm">
        {check.required.map((r) => (
          <li key={r.name} className="flex items-center gap-2">
            <span className={r.available ? "text-green-600" : "text-red-600"} aria-hidden>
              {r.available ? "✓" : "✕"}
            </span>
            <span className={r.available ? "" : "text-foreground/60"}>{r.label}</span>
            <span className="sr-only">{r.available ? "доступен" : "нет доступа"}</span>
          </li>
        ))}
      </ul>
      {check.other.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-foreground/60">Другие доступные объекты ({check.other.length})</summary>
          <p className="mt-2 text-xs leading-relaxed text-foreground/50">{check.other.join(", ")}</p>
        </details>
      )}
    </div>
  );
}

export function OneCSettingsForm({ saved }: { saved: Saved }) {
  const router = useRouter();
  const [editing, setEditing] = useState(!saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState<string | null>(null);
  const [check, setCheck] = useState<OneCCheck | null>(null);
  const [checking, setChecking] = useState(false);

  const runCheck = useCallback(async () => {
    setChecking(true);
    setCheck(await checkOneCConnection());
    setChecking(false);
  }, []);

  // A saved connection is checked as soon as the tab opens.
  useEffect(() => {
    if (saved) runCheck();
  }, [saved, runCheck]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const result = await saveOneCSettings({
      baseUrl: String(form.get("baseUrl") ?? ""),
      login: String(form.get("login") ?? ""),
      password: String(form.get("password") ?? ""),
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditing(false);
    setPassword(null);
    router.refresh();
    runCheck();
  }

  async function handleReveal() {
    if (password !== null) {
      setPassword(null);
      return;
    }
    const result = await revealOneCPassword();
    if (result.ok) setPassword(result.password);
    else setError(result.error);
  }

  async function handleDelete() {
    if (!confirm("Отключить 1С? Сохранённые адрес, логин и пароль будут удалены.")) return;
    await deleteOneCSettings();
    setCheck(null);
    setEditing(true);
    router.refresh();
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-semibold">1С:Бухгалтерия</h1>
      <p className="mt-1 text-sm text-foreground/60">
        Доступ сайта к 1С:Бухгалтерии в 1С:Фреш через стандартный интерфейс OData. Пароль хранится в зашифрованном
        виде.
      </p>

      {saved && !editing ? (
        <div className="mt-4 rounded-lg border border-foreground/10 p-4">
          <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-foreground/50">Адрес базы</dt>
            <dd className="break-all">{saved.baseUrl}</dd>
            <dt className="text-foreground/50">Логин</dt>
            <dd>{saved.login}</dd>
            <dt className="text-foreground/50">Пароль</dt>
            <dd className="flex items-center gap-3">
              <span className="font-mono">{password ?? "••••••••"}</span>
              <button type="button" onClick={handleReveal} className="text-xs text-foreground/60 underline underline-offset-4">
                {password === null ? "Показать" : "Скрыть"}
              </button>
            </dd>
            <dt className="text-foreground/50">Изменено</dt>
            <dd className="text-foreground/60">
              {new Date(saved.updatedAt).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}
            </dd>
          </dl>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-md bg-foreground px-5 py-2 text-sm font-medium text-background hover:opacity-90"
            >
              Изменить
            </button>
            <button
              type="button"
              onClick={runCheck}
              disabled={checking}
              className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium hover:bg-foreground/5 disabled:opacity-50"
            >
              {checking ? "Проверяем..." : "Проверить подключение"}
            </button>
            <button type="button" onClick={handleDelete} className="ml-auto text-sm text-red-600 underline underline-offset-4">
              Отключить
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="onecBaseUrl" className="text-sm text-foreground/60">
              Адрес базы
            </label>
            <input
              id="onecBaseUrl"
              name="baseUrl"
              required
              defaultValue={saved?.baseUrl}
              placeholder="https://msk1.1cfresh.com/a/ba/3459405/ru/"
              className={inputClassName}
            />
            <p className="mt-1 text-xs text-foreground/40">Адрес из браузера, когда открыта «Бухгалтерия».</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="onecLogin" className="text-sm text-foreground/60">
                Логин пользователя OData
              </label>
              <input id="onecLogin" name="login" required autoComplete="off" defaultValue={saved?.login} className={inputClassName} />
            </div>
            <div>
              <label htmlFor="onecPassword" className="text-sm text-foreground/60">
                Пароль
              </label>
              <input
                id="onecPassword"
                name="password"
                type="password"
                autoComplete="new-password"
                required={!saved}
                placeholder={saved ? "•••••••• (сохранён)" : ""}
                className={inputClassName}
              />
              {saved && <p className="mt-1 text-xs text-foreground/40">Оставьте пустым, чтобы не менять.</p>}
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-foreground px-6 py-2 font-medium text-background hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Сохраняем..." : "Сохранить и проверить"}
            </button>
            {saved && (
              <button type="button" onClick={() => setEditing(false)} className="text-sm text-foreground/60 underline underline-offset-4">
                Отмена
              </button>
            )}
          </div>
        </form>
      )}

      {saved && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold">Доступ к данным 1С</h2>
          <div className="mt-3">
            {checking && !check && <p className="text-sm text-foreground/50">Проверяем подключение…</p>}
            {check && <CheckResult check={check} />}
          </div>
        </section>
      )}
    </div>
  );
}
