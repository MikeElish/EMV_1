import type { Metadata } from "next";
import { read, utils } from "xlsx";
import { verifyStaffSession } from "@/lib/staff-dal";
import { getMailAccount } from "@/lib/mail/account";
import { getAttachment } from "@/lib/mail/messages";
import { MailError } from "@/lib/mail/imap";
import { decodeText, detectPreview } from "@/lib/mail/preview";
import { formatSize } from "@/components/mail/format";

// Opened in a new tab from a letter: the attachment itself (image, PDF, text,
// spreadsheet) and a download button top right.

type Search = { path?: string; uid?: string; i?: string };

export async function generateMetadata({ searchParams }: { searchParams: Promise<Search> }): Promise<Metadata> {
  const { i } = await searchParams;
  return { title: `Вложение${i ? ` ${Number(i) + 1}` : ""} — Почта EMV` };
}

const MAX_TEXT_CHARS = 2_000_000;
const MAX_SHEET_ROWS = 500;
const MAX_SHEET_COLS = 40;

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14" />
    </svg>
  );
}

export default async function MailAttachmentPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { userId } = await verifyStaffSession();
  const { path = "", uid = "", i = "" } = await searchParams;
  const uidNumber = Number(uid);
  const index = Number(i);
  const account = await getMailAccount(userId);

  const query = `path=${encodeURIComponent(path)}&uid=${uidNumber}&i=${index}`;
  const fileUrl = `/admin/mail/attachment?${query}`;

  let file: Awaited<ReturnType<typeof getAttachment>> | null = null;
  let error: string | null = null;
  if (!account) error = "Почта не настроена";
  else if (!path || !Number.isInteger(uidNumber) || uidNumber <= 0 || !Number.isInteger(index) || index < 0) {
    error = "Некорректная ссылка на вложение";
  } else {
    try {
      file = await getAttachment(account, path, uidNumber, index);
    } catch (e) {
      error = e instanceof MailError ? e.message : "Не удалось открыть вложение";
    }
  }

  const preview = file ? detectPreview(file.filename, file.contentType, file.content) : null;

  let body: React.ReactNode;
  if (!file) {
    body = <p className="p-8 text-center text-sm text-red-600">{error}</p>;
  } else if (preview?.kind === "image") {
    body = (
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-foreground/5 p-6">
        {/* eslint-disable-next-line @next/next/no-img-element -- authenticated attachment URL */}
        <img src={`${fileUrl}&inline=1`} alt={file.filename} className="max-h-full max-w-full object-contain shadow" />
      </div>
    );
  } else if (preview?.kind === "pdf") {
    body = <iframe src={`${fileUrl}&inline=1`} title={file.filename} className="min-h-0 w-full flex-1 border-0" />;
  } else if (preview?.kind === "text") {
    const text = decodeText(file.content);
    body = (
      <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words p-6 font-mono text-sm">
        {text.length > MAX_TEXT_CHARS ? `${text.slice(0, MAX_TEXT_CHARS)}\n\n… файл обрезан, скачайте его целиком` : text}
      </pre>
    );
  } else if (preview?.kind === "sheet") {
    let sheets: { name: string; rows: string[][]; more: boolean }[] = [];
    try {
      const book = read(file.content, { type: "buffer" });
      sheets = book.SheetNames.slice(0, 10).map((name) => {
        const rows = utils.sheet_to_json<string[]>(book.Sheets[name], { header: 1, raw: false, defval: "" });
        return {
          name,
          rows: rows.slice(0, MAX_SHEET_ROWS).map((r) => r.slice(0, MAX_SHEET_COLS).map(String)),
          more: rows.length > MAX_SHEET_ROWS,
        };
      });
    } catch {
      sheets = [];
    }
    body = sheets.length ? (
      <div className="min-h-0 flex-1 space-y-8 overflow-auto p-6">
        {sheets.map((s) => (
          <section key={s.name}>
            {sheets.length > 1 && <h2 className="mb-2 text-sm font-semibold">{s.name}</h2>}
            <table className="border-collapse text-sm">
              <tbody>
                {s.rows.map((row, r) => (
                  <tr key={r} className={r === 0 ? "bg-foreground/5 font-medium" : ""}>
                    {row.map((cell, c) => (
                      <td key={c} className="border border-foreground/15 px-2 py-1 align-top whitespace-pre-wrap">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {s.more && <p className="mt-2 text-xs text-foreground/50">Показаны первые {MAX_SHEET_ROWS} строк — скачайте файл целиком.</p>}
          </section>
        ))}
      </div>
    ) : (
      <p className="p-8 text-center text-sm text-foreground/60">Не удалось прочитать таблицу — скачайте файл.</p>
    );
  } else {
    body = (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-sm text-foreground/60">Предпросмотр для этого типа файла недоступен.</p>
        <a href={fileUrl} download className="rounded-md bg-foreground px-5 py-2 text-sm font-medium text-background hover:opacity-90">
          Скачать файл
        </a>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-foreground/10 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{file?.filename ?? "Вложение"}</p>
          {file && <p className="text-xs text-foreground/50">{formatSize(file.content.length)}</p>}
        </div>
        {file && (
          <a
            href={fileUrl}
            download={file.filename}
            title="Скачать"
            aria-label="Скачать"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-foreground/15 transition-colors hover:bg-foreground/5"
          >
            <DownloadIcon />
          </a>
        )}
      </header>
      {body}
    </div>
  );
}
