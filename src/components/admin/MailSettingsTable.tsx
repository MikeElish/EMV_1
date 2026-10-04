"use client";

import { FitWidth } from "@/components/FitWidth";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import { Modal } from "@/components/Modal";
import {
  saveSiteMailSettings,
  saveUserMailbox,
  clearUserMailbox,
  type ActionResult,
} from "@/actions/admin/mail-settings";
import { MAIL_DEFAULTS } from "@/lib/validators/mail-settings";
import { ROLE_LABELS } from "@/lib/validators/crm";

type SiteMail = {
  smtpHost: string;
  smtpPort: number;
  imapHost: string;
  imapPort: number;
  login: string;
  senderEmail: string;
  senderName: string;
};

type MailUser = {
  id: string;
  lastName: string | null;
  firstName: string | null;
  login: string;
  role: Role;
  mailLogin: string | null;
  hasPassword: boolean;
};

const inputClassName =
  "mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50";

const SAVED_PASSWORD_PLACEHOLDER = "••••••••";

function SavedPasswordHint({ saved }: { saved: boolean }) {
  return saved ? (
    <p className="mt-1 text-xs text-foreground/40">Сохранён. Оставьте пустым, чтобы не менять.</p>
  ) : null;
}

function Status({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return <span className={ok ? "text-green-600" : "text-foreground/40"}>{ok ? yes : no}</span>;
}

function useSubmit(action: (form: FormData) => Promise<ActionResult>, onSuccess: () => void) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await action(new FormData(event.currentTarget));
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSuccess();
  }

  return { error, submitting, handleSubmit };
}

function SubmitRow({ submitting, error }: { submitting: boolean; error: string | null }) {
  return (
    <>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-foreground px-6 py-2 font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Сохраняем..." : "Сохранить"}
      </button>
    </>
  );
}

function SiteMailForm({ site, onSuccess }: { site: SiteMail | null; onSuccess: () => void }) {
  const initial = site ?? { ...MAIL_DEFAULTS, login: "", senderEmail: "", senderName: "" };
  const { error, submitting, handleSubmit } = useSubmit(
    (form) =>
      saveSiteMailSettings({
        smtpHost: String(form.get("smtpHost") ?? ""),
        smtpPort: Number(form.get("smtpPort")),
        imapHost: String(form.get("imapHost") ?? ""),
        imapPort: Number(form.get("imapPort")),
        login: String(form.get("login") ?? ""),
        password: String(form.get("password") ?? "") || undefined,
        senderEmail: String(form.get("senderEmail") ?? ""),
        senderName: String(form.get("senderName") ?? "") || undefined,
      }),
    onSuccess
  );

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      <p className="text-sm text-foreground/60">
        Ящик сайта отправляет информационные письма. Сервер и порты отсюда используются и для
        почтовых ящиков пользователей.
      </p>
      <div className="grid grid-cols-[1fr_7rem] gap-4">
        <div>
          <label htmlFor="smtpHost" className="text-sm text-foreground/60">SMTP-сервер (отправка)</label>
          <input id="smtpHost" name="smtpHost" required defaultValue={initial.smtpHost} className={inputClassName} />
        </div>
        <div>
          <label htmlFor="smtpPort" className="text-sm text-foreground/60">Порт</label>
          <input id="smtpPort" name="smtpPort" type="number" required defaultValue={initial.smtpPort} className={inputClassName} />
        </div>
      </div>
      <div className="grid grid-cols-[1fr_7rem] gap-4">
        <div>
          <label htmlFor="imapHost" className="text-sm text-foreground/60">IMAP-сервер (получение)</label>
          <input id="imapHost" name="imapHost" required defaultValue={initial.imapHost} className={inputClassName} />
        </div>
        <div>
          <label htmlFor="imapPort" className="text-sm text-foreground/60">Порт</label>
          <input id="imapPort" name="imapPort" type="number" required defaultValue={initial.imapPort} className={inputClassName} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="login" className="text-sm text-foreground/60">Логин</label>
          <input id="login" name="login" required autoComplete="off" defaultValue={initial.login} className={inputClassName} />
        </div>
        <div>
          <label htmlFor="password" className="text-sm text-foreground/60">Пароль</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required={!site}
            placeholder={site ? SAVED_PASSWORD_PLACEHOLDER : ""}
            className={inputClassName}
          />
          <SavedPasswordHint saved={!!site} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="senderEmail" className="text-sm text-foreground/60">Адрес отправителя</label>
          <input id="senderEmail" name="senderEmail" type="email" required placeholder="site@emv.one" defaultValue={initial.senderEmail} className={inputClassName} />
        </div>
        <div>
          <label htmlFor="senderName" className="text-sm text-foreground/60">Имя отправителя</label>
          <input id="senderName" name="senderName" placeholder="EMV" defaultValue={initial.senderName} className={inputClassName} />
        </div>
      </div>
      <SubmitRow submitting={submitting} error={error} />
    </form>
  );
}

function UserMailboxForm({
  user,
  site,
  onSuccess,
}: {
  user: MailUser;
  site: SiteMail | null;
  onSuccess: () => void;
}) {
  const { error, submitting, handleSubmit } = useSubmit(
    (form) =>
      saveUserMailbox(user.id, {
        login: String(form.get("login") ?? ""),
        password: String(form.get("password") ?? "") || undefined,
      }),
    onSuccess
  );
  const [clearing, setClearing] = useState(false);

  if (!site) {
    return (
      <p className="mt-4 text-sm text-red-600">
        Сначала настройте почту сайта — оттуда берутся сервер и порты для ящиков пользователей.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      <dl className="grid grid-cols-[9rem_1fr] gap-y-1 text-sm">
        <dt className="text-foreground/50">SMTP-сервер</dt>
        <dd>{site.smtpHost}:{site.smtpPort}</dd>
        <dt className="text-foreground/50">IMAP-сервер</dt>
        <dd>{site.imapHost}:{site.imapPort}</dd>
      </dl>
      <div>
        <label htmlFor="login" className="text-sm text-foreground/60">Логин (адрес почты)</label>
        <input id="login" name="login" type="email" required autoComplete="off" defaultValue={user.mailLogin ?? ""} className={inputClassName} />
      </div>
      <div>
        <label htmlFor="password" className="text-sm text-foreground/60">Пароль</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required={!user.hasPassword}
          placeholder={user.hasPassword ? SAVED_PASSWORD_PLACEHOLDER : ""}
          className={inputClassName}
        />
        <SavedPasswordHint saved={user.hasPassword} />
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <SubmitRow submitting={submitting} error={error} />
        </div>
        {user.mailLogin && (
          <button
            type="button"
            disabled={clearing}
            onClick={async () => {
              if (!confirm("Отключить почтовый ящик пользователя?")) return;
              setClearing(true);
              const result = await clearUserMailbox(user.id);
              setClearing(false);
              if (result.ok) onSuccess();
            }}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Отключить ящик
          </button>
        )}
      </div>
    </form>
  );
}

function fullName(user: MailUser) {
  return [user.lastName, user.firstName].filter(Boolean).join(" ") || user.login;
}

export function MailSettingsTable({ site, users }: { site: SiteMail | null; users: MailUser[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<"site" | MailUser | null>(null);

  function close() {
    setSelected(null);
    router.refresh();
  }

  return (
    <div>
      <h1 className="text-lg font-semibold">Почта</h1>
      <FitWidth>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-foreground/10 text-left text-foreground/50">
            <th className="py-2 pr-4">Пользователь</th>
            <th className="py-2 pr-4">Роль</th>
            <th className="py-2 pr-4">Почтовый ящик</th>
            <th className="py-2 pr-4">Статус</th>
          </tr>
        </thead>
        <tbody>
          <tr
            onClick={() => setSelected("site")}
            className="cursor-pointer border-b border-foreground/10 bg-foreground/[0.03] hover:bg-foreground/5"
          >
            <td className="py-2 pr-4 font-medium">Сайт</td>
            <td className="py-2 pr-4 text-foreground/60">Информационные письма</td>
            <td className="py-2 pr-4">{site?.senderEmail ?? "—"}</td>
            <td className="py-2 pr-4">
              <Status ok={!!site} yes="Настроено" no="Не настроено" />
            </td>
          </tr>
          {users.map((user) => (
            <tr
              key={user.id}
              onClick={() => setSelected(user)}
              className="cursor-pointer border-b border-foreground/10 hover:bg-foreground/5"
            >
              <td className="py-2 pr-4">{fullName(user)}</td>
              <td className="py-2 pr-4 text-foreground/60">{ROLE_LABELS[user.role]}</td>
              <td className="py-2 pr-4">{user.mailLogin ?? "—"}</td>
              <td className="py-2 pr-4">
                <Status ok={!!user.mailLogin && user.hasPassword} yes="Подключено" no="Не подключено" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </FitWidth>

      {selected && (
        <Modal onClose={() => setSelected(null)} maxWidthClassName="max-w-xl">
          {selected === "site" ? (
            <>
              <h2 className="text-xl font-bold">Почта сайта</h2>
              <SiteMailForm site={site} onSuccess={close} />
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold">Почта: {fullName(selected)}</h2>
              <UserMailboxForm user={selected} site={site} onSuccess={close} />
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
