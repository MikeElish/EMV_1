"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MessageDetail, MailAddress } from "@/lib/mail/messages";
import { deleteMessages, moveMessages, setMessagesSeen, type MailActionResult } from "@/actions/mail/mail";
import { refreshMailUnread } from "@/components/mail/useMailUnread";
import { MailToolbarButton, MoveSelect, type FolderRef } from "@/components/mail/MessageList";
import { formatFullDate, formatSize } from "@/components/mail/format";

function Addresses({ label, list }: { label: string; list: MailAddress[] }) {
  if (!list.length) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-14 shrink-0 text-foreground/50">{label}</span>
      <span className="min-w-0 break-words">
        {list.map((a, i) => (
          <span key={i}>
            {i > 0 && ", "}
            {a.name ? (
              <>
                {a.name} <span className="text-foreground/50">&lt;{a.address}&gt;</span>
              </>
            ) : (
              a.address
            )}
          </span>
        ))}
      </span>
    </div>
  );
}

export function MessageReader({
  folder,
  basePath,
  message,
  moveTargets,
}: {
  folder: FolderRef;
  basePath: string;
  message: MessageDetail;
  moveTargets: { path: string; name: string }[];
}) {
  const router = useRouter();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [frameHeight, setFrameHeight] = useState(300);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // The server marked the letter read while rendering this page.
  useEffect(() => {
    refreshMailUnread();
  }, [message.uid]);

  const composeQuery = (mode: string) =>
    `/admin/mail/compose?mode=${mode}&path=${encodeURIComponent(folder.path)}&uid=${message.uid}`;

  function back() {
    router.push(basePath);
  }

  function run(action: () => Promise<MailActionResult>, leave: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await refreshMailUnread();
      if (leave) back();
      else router.refresh();
    });
  }

  function fitFrame() {
    const doc = frameRef.current?.contentDocument;
    if (!doc?.body) return;
    // body, not documentElement: the latter is never smaller than the frame itself.
    setFrameHeight(Math.max(120, doc.body.scrollHeight + 4));
    // Pictures arrive after the load event and push the text down.
    doc.querySelectorAll("img").forEach((img) => {
      if (!img.complete) img.addEventListener("load", fitFrame, { once: true });
    });
  }

  const uids = [message.uid];
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <MailToolbarButton onClick={back}>← К списку</MailToolbarButton>
        <Link prefetch={false} href={composeQuery("reply")} className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:opacity-90">
          Ответить
        </Link>
        <Link prefetch={false} href={composeQuery("replyAll")} className="rounded-md border border-foreground/15 px-3 py-1.5 text-sm hover:bg-foreground/5">
          Ответить всем
        </Link>
        <Link prefetch={false} href={composeQuery("forward")} className="rounded-md border border-foreground/15 px-3 py-1.5 text-sm hover:bg-foreground/5">
          Переслать
        </Link>
        <MailToolbarButton disabled={pending} onClick={() => run(() => setMessagesSeen(folder.path, uids, false), true)}>
          Не прочитано
        </MailToolbarButton>
        <MailToolbarButton
          disabled={pending}
          onClick={() => {
            if (folder.role === "trash" && !confirm("Удалить письмо навсегда?")) return;
            run(() => deleteMessages(folder.path, uids), true);
          }}
        >
          Удалить
        </MailToolbarButton>
        {folder.role === "junk" ? (
          <MailToolbarButton disabled={pending} onClick={() => run(() => moveMessages(folder.path, uids, { role: "inbox" }), true)}>
            Не спам
          </MailToolbarButton>
        ) : (
          folder.role !== "sent" && (
            <MailToolbarButton disabled={pending} onClick={() => run(() => moveMessages(folder.path, uids, { role: "junk" }), true)}>
              Это спам
            </MailToolbarButton>
          )
        )}
        <MoveSelect targets={moveTargets} disabled={pending} onMove={(path) => run(() => moveMessages(folder.path, uids, { path }), true)} />
        {pending && <span className="text-xs text-foreground/50">Подождите…</span>}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <h1 className="mt-6 text-xl font-semibold">{message.subject}</h1>
      <div className="mt-3 space-y-1">
        <Addresses label="От" list={message.from} />
        <Addresses label="Кому" list={message.to} />
        <Addresses label="Копия" list={message.cc} />
        <div className="flex gap-2 text-sm">
          <span className="w-14 shrink-0 text-foreground/50">Дата</span>
          <span>{formatFullDate(message.date)}</span>
        </div>
      </div>

      {message.attachments.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {message.attachments.map((a) => (
            <a
              key={a.index}
              href={`/admin/mail/attachment?path=${encodeURIComponent(folder.path)}&uid=${message.uid}&i=${a.index}`}
              className="rounded-md border border-foreground/15 px-3 py-1.5 text-sm hover:bg-foreground/5"
            >
              📎 {a.filename} <span className="text-foreground/50">({formatSize(a.size)})</span>
            </a>
          ))}
        </div>
      )}

      {/* No scripts can run in the letter: sandbox without allow-scripts.
          allow-same-origin only lets us measure its height. */}
      <iframe
        ref={frameRef}
        title="Текст письма"
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        srcDoc={message.html}
        onLoad={fitFrame}
        style={{ height: frameHeight }}
        className="mt-5 w-full rounded-lg border border-foreground/10 bg-white"
      />
    </div>
  );
}
