"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { formatRub } from "@/lib/money";
import { Modal } from "@/components/Modal";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { deleteBankAccount, saveBankAccount, syncBankNow, uploadStatement } from "@/actions/admin/banks";

type Account = {
  id: string;
  name: string;
  kind: string;
  accountNumber: string;
  bik: string;
  hasToken: boolean;
  isActive: boolean;
  lastSyncAt: string | null;
  lastSyncNote: string | null;
};
type Tx = {
  id: string;
  bank: string;
  date: string;
  incoming: boolean;
  amount: number;
  counterparty: string | null;
  inn: string | null;
  purpose: string | null;
  orderNumber: string | null;
  matchNote: string | null;
};

const KINDS: Record<string, string> = { TOCHKA_API: "Точка — по API", STATEMENT_FILE: "Выписка 1С (файл)" };
const inputClass =
  "mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/50";
const when = (iso: string) => new Date(iso).toLocaleString("ru-RU", { timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function AccountForm({ account, onClose }: { account: Account | null; onClose: () => void }) {
  const [kind, setKind] = useState(account?.kind ?? "TOCHKA_API");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    startTransition(async () => {
      const r = await saveBankAccount(account?.id ?? null, {
        name: String(f.get("name") ?? ""),
        kind,
        accountNumber: String(f.get("accountNumber") ?? ""),
        bik: String(f.get("bik") ?? ""),
        token: String(f.get("token") ?? ""),
        isActive: f.get("isActive") === "on",
      });
      if (!r.ok) setError(r.error);
      else onClose();
    });
  }

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-lg">
      <h2 className="text-lg font-semibold">{account ? "Банковский счёт" : "Новый банковский счёт"}</h2>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <div>
          <label className="text-sm text-foreground/60">Название *</label>
          <input name="name" required defaultValue={account?.name} placeholder="Точка, Банк Санкт-Петербург, ВТБ" className={inputClass} />
        </div>
        <div>
          <label className="text-sm text-foreground/60">Как загружать выписку</label>
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={inputClass}>
            {Object.entries(KINDS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="text-sm text-foreground/60">Расчётный счёт *</label>
            <input name="accountNumber" required inputMode="numeric" defaultValue={account?.accountNumber} className={inputClass} />
          </div>
          <div>
            <label className="text-sm text-foreground/60">БИК</label>
            <input name="bik" inputMode="numeric" defaultValue={account?.bik} className={inputClass} />
          </div>
        </div>
        {kind === "TOCHKA_API" && (
          <div>
            <label className="text-sm text-foreground/60">Токен Точки (JWT)</label>
            <textarea
              name="token"
              rows={3}
              placeholder={account?.hasToken ? "Задан — оставьте пустым, чтобы не менять" : "Интернет-банк Точки → Интеграции и API → Подключить → JWT-токен с правом на выписки"}
              className={`${inputClass} font-mono text-xs`}
            />
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input name="isActive" type="checkbox" defaultChecked={account?.isActive ?? true} />
          Используется
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-md border border-foreground/20 px-4 py-2 text-sm">
            Отмена
          </button>
          <button type="submit" disabled={pending} className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50">
            {pending ? "..." : "Сохранить"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AccountCard({ account, onEdit }: { account: Account; onEdit: () => void }) {
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function sync() {
    setNote(null);
    startTransition(async () => {
      const r = await syncBankNow(account.id);
      setNote(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
    });
  }
  function upload(file: File) {
    const f = new FormData();
    f.set("accountId", account.id);
    f.set("file", file);
    setNote(null);
    startTransition(async () => {
      const r = await uploadStatement(f);
      setNote(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
    });
  }

  return (
    <div className={`rounded-md border border-foreground/10 p-4 ${account.isActive ? "" : "opacity-60"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{account.name}</p>
          <p className="text-xs text-foreground/50">
            {account.accountNumber}
            {account.bik && ` · БИК ${account.bik}`} · {KINDS[account.kind]}
            {account.kind === "TOCHKA_API" && !account.hasToken && <span className="text-red-600"> · токен не задан</span>}
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <button type="button" onClick={onEdit} className="hover:underline">
            Изменить
          </button>
          <DeleteButton action={() => deleteBankAccount(account.id)} confirmText={`Удалить счёт «${account.name}» и его операции?`} className="text-red-600 hover:underline disabled:opacity-50" />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {account.kind === "TOCHKA_API" && (
          <button
            type="button"
            onClick={sync}
            disabled={pending || !account.hasToken}
            className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background disabled:opacity-50"
          >
            {pending ? "Загружаем..." : "Загрузить выписку сейчас"}
          </button>
        )}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={pending}
          className="rounded-md border border-foreground/20 px-3 py-1.5 text-sm hover:bg-foreground/5 disabled:opacity-50"
        >
          Загрузить файл выписки (1С)
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".txt"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) upload(file);
          }}
        />
      </div>
      {note && <p className={`mt-2 text-sm ${note.ok ? "text-green-600" : "text-red-600"}`}>{note.text}</p>}
      {account.lastSyncNote && (
        <p className="mt-2 text-xs text-foreground/50">
          {account.lastSyncAt ? `Последняя загрузка ${when(account.lastSyncAt)}: ` : ""}
          {account.lastSyncNote}
        </p>
      )}
    </div>
  );
}

export function BanksSettings({ accounts, transactions }: { accounts: Account[]; transactions: Tx[] }) {
  const [editing, setEditing] = useState<Account | "new" | null>(null);
  const [onlyIncoming, setOnlyIncoming] = useState(true);
  const shown = transactions.filter((t) => !onlyIncoming || t.incoming);

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setEditing("new")}
            aria-label="Добавить счёт"
            className="flex h-8 w-8 items-center justify-center rounded-md bg-green-600 text-lg font-bold leading-none text-white hover:opacity-90"
          >
            +
          </button>
          <h1 className="text-lg font-semibold">Банки</h1>
        </div>
        <p className="mt-2 text-sm text-foreground/60">
          Точка загружается сама в 10:00, 14:00 и 20:00 (Москва), остальные банки — файлом выписки в формате 1С (kl_to_1c.txt). Входящий
          платёж ищет свой заказ: ИНН плательщика — компании заказа, в назначении — номер счёта или заказа, иначе единственный
          неоплаченный заказ на эту сумму. Полная оплата отмечает заказ оплаченным.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {accounts.map((a) => (
            <AccountCard key={a.id} account={a} onEdit={() => setEditing(a)} />
          ))}
          {!accounts.length && <p className="text-sm text-foreground/40">Счетов пока нет — добавьте зелёным «+».</p>}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-3">
          <h2 className="font-semibold">Операции</h2>
          <label className="flex items-center gap-2 text-sm text-foreground/70">
            <input type="checkbox" checked={onlyIncoming} onChange={(e) => setOnlyIncoming(e.target.checked)} />
            Только поступления
          </label>
        </div>
        {shown.length === 0 ? (
          <p className="mt-3 text-sm text-foreground/40">Операций пока нет.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-foreground/50">
                  <th className="py-1.5 pr-3">Дата</th>
                  <th className="py-1.5 pr-3">Банк</th>
                  <th className="py-1.5 pr-3 text-right">Сумма</th>
                  <th className="py-1.5 pr-3">Контрагент</th>
                  <th className="py-1.5 pr-3">Назначение</th>
                  <th className="py-1.5 pr-3">Заказ</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((t) => (
                  <tr key={t.id} className="border-t border-foreground/10 align-top">
                    <td className="whitespace-nowrap py-1.5 pr-3">{new Date(t.date).toLocaleDateString("ru-RU")}</td>
                    <td className="py-1.5 pr-3">{t.bank}</td>
                    <td className={`whitespace-nowrap py-1.5 pr-3 text-right ${t.incoming ? "text-green-700 dark:text-green-500" : ""}`}>
                      {t.incoming ? "+" : "−"}
                      {formatRub(t.amount)}
                    </td>
                    <td className="py-1.5 pr-3">
                      {t.counterparty ?? "—"}
                      {t.inn && <div className="text-xs text-foreground/50">ИНН {t.inn}</div>}
                    </td>
                    <td className="max-w-md py-1.5 pr-3 text-xs text-foreground/70">{t.purpose}</td>
                    <td className="py-1.5 pr-3">
                      {t.orderNumber && <div className="font-medium">{t.orderNumber}</div>}
                      {t.matchNote && <div className="text-xs text-foreground/50">{t.matchNote}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && <AccountForm account={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
