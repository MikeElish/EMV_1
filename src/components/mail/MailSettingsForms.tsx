"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  clearMyMailbox,
  deleteSignatureLogo,
  saveMailPreferences,
  uploadSignatureLogo,
  saveMyMailbox,
  type SettingsResult,
} from "@/actions/mail/settings";
import { createFolder, deleteFolder, renameFolder } from "@/actions/mail/mail";
import { MAIL_PAGE_SIZES } from "@/lib/validators/mail";
import type { MailFolder } from "@/lib/mail/imap";
import { refreshMailUnread } from "@/components/mail/useMailUnread";

const inputClassName =
  "mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50";
const primaryButton =
  "rounded-md bg-foreground px-6 py-2 font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50";

function Result({ result }: { result: SettingsResult | null }) {
  if (!result) return null;
  return result.ok ? (
    <p className="text-sm text-green-600">{result.message}</p>
  ) : (
    <p className="text-sm text-red-600">{result.error}</p>
  );
}

type Prefs = { senderName: string; signature: string; pageSize: number };

function usePrefsSave(prefs: Prefs) {
  const router = useRouter();
  const [result, setResult] = useState<SettingsResult | null>(null);
  const [pending, startTransition] = useTransition();
  function save(patch: Partial<Prefs>) {
    setResult(null);
    startTransition(async () => {
      setResult(await saveMailPreferences({ ...prefs, ...patch }));
      router.refresh();
    });
  }
  return { result, pending, save };
}

function SignatureLogo({ logo }: { logo: string | null }) {
  const router = useRouter();
  const [result, setResult] = useState<SettingsResult | null>(null);
  const [pending, startTransition] = useTransition();

  function upload(file: File) {
    const form = new FormData();
    form.set("logo", file);
    setResult(null);
    startTransition(async () => {
      setResult(await uploadSignatureLogo(form));
      router.refresh();
    });
  }

  return (
    <div>
      <p className="text-sm text-foreground/60">Логотип в подписи</p>
      <div className="mt-2 flex items-center gap-4">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- data: URI preview
          <img
            src={logo}
            alt="Логотип подписи"
            className="max-h-20 max-w-[240px] rounded border border-foreground/10 bg-white p-1"
          />
        ) : (
          <span className="text-sm text-foreground/40">не загружен</span>
        )}
        <label className="cursor-pointer text-sm text-foreground/70 underline underline-offset-4 hover:text-foreground">
          {logo ? "Заменить" : "Загрузить"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif"
            aria-label="Файл логотипа"
            className="hidden"
            disabled={pending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) upload(file);
            }}
          />
        </label>
        {logo && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setResult(await deleteSignatureLogo());
                router.refresh();
              })
            }
            className="text-sm text-red-600 underline underline-offset-4"
          >
            Удалить
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-foreground/40">
        PNG, JPEG или GIF до 300 КБ. Встраивается в письмо под подписью (не больше 240×80 точек).
      </p>
      {pending && <p className="text-sm text-foreground/50">Подождите…</p>}
      <Result result={result} />
    </div>
  );
}

export function PersonalSettings({ logo, ...prefs }: Prefs & { logo: string | null }) {
  const { result, pending, save } = usePrefsSave(prefs);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    save({
      senderName: String(form.get("senderName") ?? ""),
      signature: String(form.get("signature") ?? ""),
    });
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <h1 className="text-lg font-semibold">Личные данные, подпись</h1>
        <div>
          <label htmlFor="senderName" className="text-sm text-foreground/60">
            Имя отправителя
          </label>
          <input
            id="senderName"
            name="senderName"
            defaultValue={prefs.senderName}
            placeholder="По умолчанию — имя и фамилия из профиля"
            className={inputClassName}
          />
        </div>
        <div>
          <label htmlFor="signature" className="text-sm text-foreground/60">
            Подпись
          </label>
          <textarea
            id="signature"
            name="signature"
            rows={5}
            defaultValue={prefs.signature}
            placeholder={"С уважением,\nИван Иванов\nEMV"}
            className={inputClassName}
          />
          <p className="mt-1 text-xs text-foreground/40">
            Подставляется в новые письма, ответы и пересылки.
          </p>
        </div>
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Сохраняем..." : "Сохранить"}
        </button>
        <Result result={result} />
      </form>
      <div className="mt-8 border-t border-foreground/10 pt-6">
        <SignatureLogo logo={logo} />
      </div>
    </>
  );
}

export function OtherSettings(prefs: Prefs) {
  const { result, pending, save } = usePrefsSave(prefs);
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Прочее</h1>
      <div className="flex items-center gap-3">
        <label htmlFor="pageSize" className="text-sm">
          Писем на странице
        </label>
        <select
          id="pageSize"
          defaultValue={prefs.pageSize}
          disabled={pending}
          onChange={(e) => save({ pageSize: Number(e.target.value) })}
          className="rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm"
        >
          {MAIL_PAGE_SIZES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <Result result={result} />
    </div>
  );
}

export function ProgramsSettings({
  login,
  hasPassword,
  servers,
  isOwner,
}: {
  login: string;
  hasPassword: boolean;
  servers: { imapHost: string; imapPort: number; smtpHost: string; smtpPort: number };
  isOwner: boolean;
}) {
  const router = useRouter();
  const [result, setResult] = useState<SettingsResult | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const target = event.currentTarget;
    setResult(null);
    startTransition(async () => {
      const saved = await saveMyMailbox({
        login: String(form.get("mailLogin") ?? ""),
        password: String(form.get("mailPassword") ?? ""),
      });
      setResult(saved);
      target.querySelector<HTMLInputElement>("#mailPassword")!.value = "";
      await refreshMailUnread();
      router.refresh();
    });
  }

  function handleClear() {
    if (!confirm("Отключить почтовый ящик? Письма останутся на сервере Яндекса.")) return;
    setResult(null);
    startTransition(async () => {
      setResult(await clearMyMailbox());
      await refreshMailUnread();
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <h1 className="text-lg font-semibold">Почтовые программы</h1>
        <p className="text-sm text-foreground/60">
          Почта на сайте работает с вашим ящиком Яндекса по протоколам IMAP и SMTP.
        </p>
        <div>
          <label htmlFor="mailLogin" className="text-sm text-foreground/60">
            Адрес ящика (логин)
          </label>
          <input
            id="mailLogin"
            name="mailLogin"
            type="email"
            required
            defaultValue={login}
            placeholder="name@emv.one"
            className={inputClassName}
          />
        </div>
        <div>
          <label htmlFor="mailPassword" className="text-sm text-foreground/60">
            Пароль приложения
          </label>
          <input
            id="mailPassword"
            name="mailPassword"
            type="password"
            autoComplete="new-password"
            required={!hasPassword}
            placeholder={hasPassword ? "•••••••• (сохранён)" : ""}
            className={inputClassName}
          />
          {hasPassword && (
            <p className="mt-1 text-xs text-foreground/40">Оставьте пустым, чтобы не менять.</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className={primaryButton}>
            {pending ? "Проверяем..." : "Сохранить и проверить"}
          </button>
          {hasPassword && (
            <button
              type="button"
              onClick={handleClear}
              disabled={pending}
              className="text-sm text-red-600 underline underline-offset-4"
            >
              Отключить ящик
            </button>
          )}
        </div>
        <Result result={result} />
      </form>

      <div className="rounded-lg border border-foreground/10 p-4 text-sm">
        <p className="font-medium">Как подключить ящик Яндекса</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-foreground/70">
          <li>
            В Яндекс.Почте откройте «Все настройки → Почтовые программы» и включите доступ «С
            сервера imap.yandex.ru по протоколу IMAP» и способ авторизации «Пароли приложений и
            OAuth-токены».
          </li>
          <li>
            В Яндекс ID → «Безопасность → Пароли приложений» создайте пароль для «Почты» и вставьте
            его выше. Обычный пароль от Яндекса здесь не подойдёт.
          </li>
        </ol>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-foreground/60">
          <dt>Входящая почта</dt>
          <dd>
            {servers.imapHost}:{servers.imapPort} (IMAP, SSL)
          </dd>
          <dt>Исходящая почта</dt>
          <dd>
            {servers.smtpHost}:{servers.smtpPort} (SMTP, SSL)
          </dd>
        </dl>
        {isOwner && (
          <p className="mt-2 text-xs text-foreground/40">
            Серверы общие для всех сотрудников:{" "}
            <Link href="/admin/settings/mail" className="underline underline-offset-4">
              Настройки → Почта
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

export function FoldersSettings({
  folders,
  error,
}: {
  folders: MailFolder[] | null;
  error: string | null;
}) {
  const router = useRouter();
  const [result, setResult] = useState<SettingsResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");

  function run(
    action: () => Promise<{ ok: true } | { ok: false; error: string }>,
    message: string
  ) {
    setResult(null);
    startTransition(async () => {
      const r = await action();
      setResult(r.ok ? { ok: true, message } : r);
      if (r.ok) {
        setName("");
        await refreshMailUnread();
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Папки</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(() => createFolder(name), "Папка создана");
        }}
        className="flex gap-2"
      >
        <input
          aria-label="Название новой папки"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Название новой папки"
          className="flex-1 rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/50"
        />
        <button type="submit" disabled={pending || !name.trim()} className={primaryButton}>
          Создать
        </button>
      </form>
      <Result result={result} />

      {folders && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-foreground/10 text-left text-foreground/50">
              <th className="py-2 font-normal">Папка</th>
              <th className="py-2 text-right font-normal">Писем</th>
              <th className="py-2 text-right font-normal">Непрочитанных</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {folders.map((f) => (
              <tr key={f.path} className="border-b border-foreground/5">
                <td className="py-2">{f.name}</td>
                <td className="py-2 text-right">{f.messages}</td>
                <td className="py-2 text-right">{f.unseen || ""}</td>
                <td className="py-2 text-right">
                  {f.role === "custom" ? (
                    <span className="space-x-3">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          const next = prompt("Новое название папки", f.name);
                          if (next && next.trim() !== f.name)
                            run(() => renameFolder(f.path, next), "Папка переименована");
                        }}
                        className="text-foreground/60 underline underline-offset-4 hover:text-foreground"
                      >
                        Переименовать
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          if (confirm(`Удалить папку «${f.name}» вместе с письмами в ней?`))
                            run(() => deleteFolder(f.path), "Папка удалена");
                        }}
                        className="text-red-600 underline underline-offset-4"
                      >
                        Удалить
                      </button>
                    </span>
                  ) : (
                    <span className="text-xs text-foreground/40">системная</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
