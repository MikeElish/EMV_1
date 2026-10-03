"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { saveDraft, sendMail } from "@/actions/mail/mail";
import { refreshMailUnread } from "@/components/mail/useMailUnread";
import { MAX_ATTACHMENTS_BYTES } from "@/lib/validators/mail";
import { formatSize } from "@/components/mail/format";

export type ComposeInitial = {
  to: string;
  cc: string;
  subject: string;
  body: string;
  draftUid?: number;
  inReplyTo?: string;
  references?: string[];
  /** Attachments taken over from the forwarded letter / reopened draft. */
  carried?: { path: string; uid: number; names: string[] };
};

const inputClassName =
  "w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50";

export function ComposeForm({ initial, from }: { initial: ComposeInitial; from: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [showCc, setShowCc] = useState(!!initial.cc);
  const [files, setFiles] = useState<File[]>([]);
  const [draftUid, setDraftUid] = useState(initial.draftUid ?? 0);
  const [carried, setCarried] = useState(initial.carried);
  const [busy, setBusy] = useState<"send" | "draft" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const totalSize = files.reduce((n, f) => n + f.size, 0);

  function formData() {
    const data = new FormData(formRef.current!);
    data.delete("picker");
    for (const f of files) data.append("files", f);
    if (draftUid) data.set("draftUid", String(draftUid));
    if (initial.inReplyTo) data.set("inReplyTo", initial.inReplyTo);
    if (initial.references?.length) data.set("references", initial.references.join(" "));
    if (carried) {
      data.set("attachFromPath", carried.path);
      data.set("attachFromUid", String(carried.uid));
    }
    return data;
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (totalSize > MAX_ATTACHMENTS_BYTES) {
      setError("Вложения больше 15 МБ");
      return;
    }
    setError(null);
    setNotice(null);
    setBusy("send");
    const result = await sendMail(formData());
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await refreshMailUnread();
    router.push("/admin/mail/sent");
  }

  async function handleDraft() {
    setError(null);
    setNotice(null);
    setBusy("draft");
    const result = await saveDraft(formData());
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.draftUid) {
      // The new draft now carries the attachments; uploaded files are in it.
      const names = [...(carried?.names ?? []), ...files.map((f) => f.name)];
      setDraftUid(result.draftUid);
      setCarried(names.length ? { path: result.draftsPath, uid: result.draftUid, names } : undefined);
      setFiles([]);
    }
    setNotice(`Черновик сохранён в ${new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`);
  }

  return (
    <form ref={formRef} onSubmit={handleSend} className="max-w-3xl space-y-3">
      <div className="flex items-center gap-3 text-sm">
        <span className="w-16 shrink-0 text-foreground/50">От</span>
        <span>{from}</span>
      </div>
      <div className="flex items-center gap-3">
        <label htmlFor="mail-to" className="w-16 shrink-0 text-sm text-foreground/50">
          Кому
        </label>
        <input
          id="mail-to"
          name="to"
          defaultValue={initial.to}
          placeholder="адрес@пример.ru, несколько — через запятую"
          className={inputClassName}
        />
        {!showCc && (
          <button type="button" onClick={() => setShowCc(true)} className="shrink-0 text-sm text-foreground/60 underline underline-offset-4">
            Копия
          </button>
        )}
      </div>
      {showCc && (
        <div className="flex items-center gap-3">
          <label htmlFor="mail-cc" className="w-16 shrink-0 text-sm text-foreground/50">
            Копия
          </label>
          <input id="mail-cc" name="cc" defaultValue={initial.cc} className={inputClassName} />
        </div>
      )}
      <div className="flex items-center gap-3">
        <label htmlFor="mail-subject" className="w-16 shrink-0 text-sm text-foreground/50">
          Тема
        </label>
        <input id="mail-subject" name="subject" defaultValue={initial.subject} className={inputClassName} />
      </div>

      <textarea
        name="body"
        aria-label="Текст письма"
        defaultValue={initial.body}
        rows={16}
        autoFocus
        onFocus={(e) => {
          // Start typing above the signature / quote.
          if (e.currentTarget.selectionStart === e.currentTarget.value.length && initial.body.startsWith("\n")) {
            e.currentTarget.setSelectionRange(0, 0);
          }
        }}
        className={`${inputClassName} font-sans text-sm leading-relaxed`}
      />

      <div className="space-y-2">
        {carried && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {carried.names.map((name, i) => (
              <span key={i} className="rounded-md border border-foreground/15 px-2 py-1">
                📎 {name}
              </span>
            ))}
            <button type="button" onClick={() => setCarried(undefined)} className="text-xs text-foreground/50 underline underline-offset-4">
              убрать эти вложения
            </button>
          </div>
        )}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 text-sm">
            {files.map((f, i) => (
              <span key={i} className="flex items-center gap-1 rounded-md border border-foreground/15 px-2 py-1">
                📎 {f.name} <span className="text-foreground/50">({formatSize(f.size)})</span>
                <button
                  type="button"
                  aria-label={`Убрать ${f.name}`}
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                  className="ml-1 text-foreground/40 hover:text-foreground"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
        <label className="inline-block cursor-pointer text-sm text-foreground/60 underline underline-offset-4 hover:text-foreground">
          Прикрепить файл
          <input
            type="file"
            name="picker"
            multiple
            className="hidden"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              setFiles((prev) => [...prev, ...picked]);
              e.target.value = "";
            }}
          />
        </label>
        {totalSize > MAX_ATTACHMENTS_BYTES && (
          <p className="text-sm text-red-600">Вложения больше 15 МБ ({formatSize(totalSize)})</p>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && <p className="text-sm text-green-600">{notice}</p>}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={busy !== null}
          className="rounded-md bg-foreground px-6 py-2 font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy === "send" ? "Отправляем..." : "Отправить"}
        </button>
        <button
          type="button"
          onClick={handleDraft}
          disabled={busy !== null}
          className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium hover:bg-foreground/5 disabled:opacity-50"
        >
          {busy === "draft" ? "Сохраняем..." : "Сохранить черновик"}
        </button>
        <button type="button" onClick={() => router.back()} className="text-sm text-foreground/60 underline underline-offset-4">
          Отмена
        </button>
      </div>
    </form>
  );
}
