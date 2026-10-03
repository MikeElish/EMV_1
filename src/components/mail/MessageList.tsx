"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FolderRole } from "@/lib/mail/imap";
import type { MessagePage, MailAddress } from "@/lib/mail/messages";
import { deleteMessages, moveMessages, setMessagesSeen, type MailActionResult } from "@/actions/mail/mail";
import { refreshMailUnread } from "@/components/mail/useMailUnread";
import { formatMailDate } from "@/components/mail/format";

export type FolderRef = { path: string; role: FolderRole; name: string };

const who = (list: MailAddress[]) => list.map((a) => a.name || a.address).join(", ") || "—";

export function MailToolbarButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="rounded-md border border-foreground/15 px-3 py-1.5 text-sm transition-colors hover:bg-foreground/5 disabled:opacity-40"
    />
  );
}

export function MoveSelect({
  targets,
  disabled,
  onMove,
}: {
  targets: { path: string; name: string }[];
  disabled: boolean;
  onMove: (path: string) => void;
}) {
  return (
    <select
      aria-label="Переместить в папку"
      disabled={disabled || targets.length === 0}
      value=""
      onChange={(e) => e.target.value && onMove(e.target.value)}
      className="rounded-md border border-foreground/15 bg-background px-2 py-1.5 text-sm disabled:opacity-40"
    >
      <option value="">В папку…</option>
      {targets.map((t) => (
        <option key={t.path} value={t.path}>
          {t.name}
        </option>
      ))}
    </select>
  );
}

export function MessageList({
  folder,
  basePath,
  data,
  moveTargets,
}: {
  folder: FolderRef;
  basePath: string;
  data: MessagePage;
  moveTargets: { path: string; name: string }[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const outgoing = folder.role === "sent" || folder.role === "drafts";
  const query = basePath.includes("?") ? "&" : "?";
  const uids = [...selected];
  const allSelected = data.items.length > 0 && selected.size === data.items.length;

  function run(action: () => Promise<MailActionResult>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSelected(new Set());
      await refreshMailUnread();
      router.refresh();
    });
  }

  function toggle(uid: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  const href = (uid: number) => {
    if (folder.role === "drafts") return `/admin/mail/compose?draft=${uid}`;
    const [path, search] = basePath.split("?");
    return `${path}/${uid}${search ? `?${search}` : ""}`;
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <input
          type="checkbox"
          aria-label="Выбрать все"
          checked={allSelected}
          onChange={() => setSelected(allSelected ? new Set() : new Set(data.items.map((m) => m.uid)))}
          className="mr-1"
        />
        <MailToolbarButton disabled={!uids.length || pending} onClick={() => run(() => setMessagesSeen(folder.path, uids, true))}>
          Прочитано
        </MailToolbarButton>
        <MailToolbarButton disabled={!uids.length || pending} onClick={() => run(() => setMessagesSeen(folder.path, uids, false))}>
          Не прочитано
        </MailToolbarButton>
        <MailToolbarButton
          disabled={!uids.length || pending}
          onClick={() => {
            if (folder.role === "trash" && !confirm("Удалить выбранные письма навсегда?")) return;
            run(() => deleteMessages(folder.path, uids));
          }}
        >
          Удалить
        </MailToolbarButton>
        {folder.role === "junk" ? (
          <MailToolbarButton disabled={!uids.length || pending} onClick={() => run(() => moveMessages(folder.path, uids, { role: "inbox" }))}>
            Не спам
          </MailToolbarButton>
        ) : (
          !outgoing && (
            <MailToolbarButton disabled={!uids.length || pending} onClick={() => run(() => moveMessages(folder.path, uids, { role: "junk" }))}>
              Это спам
            </MailToolbarButton>
          )
        )}
        <MoveSelect
          targets={moveTargets}
          disabled={!uids.length || pending}
          onMove={(path) => run(() => moveMessages(folder.path, uids, { path }))}
        />
        <MailToolbarButton disabled={pending} onClick={() => startTransition(() => router.refresh())}>
          Обновить
        </MailToolbarButton>
        {pending && <span className="text-xs text-foreground/50">Подождите…</span>}
        <span className="ml-auto text-xs text-foreground/50">Писем: {data.total}</span>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {data.items.length === 0 ? (
        <p className="mt-10 text-center text-sm text-foreground/40">В папке «{folder.name}» нет писем</p>
      ) : (
        <ul
          aria-label="Письма"
          className="mt-3 min-h-0 flex-1 divide-y divide-foreground/10 overflow-y-auto border-y border-foreground/10"
        >
          {data.items.map((m) => (
            <li
              key={m.uid}
              className={`flex items-center gap-3 px-2 py-2 text-sm transition-colors hover:bg-foreground/5 ${
                selected.has(m.uid) ? "bg-foreground/5" : ""
              }`}
            >
              <input
                type="checkbox"
                aria-label="Выбрать письмо"
                checked={selected.has(m.uid)}
                onChange={() => toggle(m.uid)}
              />
              <span
                aria-label={m.seen ? undefined : "Не прочитано"}
                className={`h-2 w-2 shrink-0 rounded-full ${m.seen ? "" : "bg-blue-500"}`}
              />
              <Link
                href={href(m.uid)}
                prefetch={false}
                className={`flex min-w-0 flex-1 items-center gap-4 ${m.seen ? "text-foreground/80" : "font-bold text-foreground"}`}
              >
                <span className="w-56 shrink-0 truncate">{outgoing ? who(m.to) : who(m.from)}</span>
                <span className="min-w-0 flex-1 truncate">{m.subject}</span>
                {m.hasAttachments && (
                  <span aria-label="Есть вложения" title="Есть вложения" className="shrink-0 text-foreground/50">
                    📎
                  </span>
                )}
                <span className="w-24 shrink-0 text-right text-xs font-normal text-foreground/50">
                  {formatMailDate(m.date)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {data.pages > 1 && (
        <div className="mt-3 flex shrink-0 items-center justify-center gap-4 text-sm">
          {data.page > 1 ? (
            <Link prefetch={false} href={`${basePath}${query}page=${data.page - 1}`} className="underline underline-offset-4">
              ← Новее
            </Link>
          ) : (
            <span className="text-foreground/30">← Новее</span>
          )}
          <span className="text-foreground/50">
            Страница {data.page} из {data.pages}
          </span>
          {data.page < data.pages ? (
            <Link prefetch={false} href={`${basePath}${query}page=${data.page + 1}`} className="underline underline-offset-4">
              Старее →
            </Link>
          ) : (
            <span className="text-foreground/30">Старее →</span>
          )}
        </div>
      )}
    </div>
  );
}
