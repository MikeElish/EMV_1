import { getStaffSession } from "@/lib/staff-dal";
import { getMailAccount } from "@/lib/mail/account";
import { getAttachment } from "@/lib/mail/messages";
import { MailError } from "@/lib/mail/imap";
import { decodeText, detectPreview } from "@/lib/mail/preview";

/** Downloads one attachment of a letter in the employee's own mailbox. */
export async function GET(request: Request) {
  const session = await getStaffSession("view");
  if (!session) return new Response("Требуется вход", { status: 401 });
  const account = await getMailAccount(session.userId);
  if (!account) return new Response("Почта не настроена", { status: 404 });

  const params = new URL(request.url).searchParams;
  const path = params.get("path") ?? "";
  const uid = Number(params.get("uid"));
  const index = Number(params.get("i"));
  if (!path || !Number.isInteger(uid) || uid <= 0 || !Number.isInteger(index) || index < 0) {
    return new Response("Некорректный запрос", { status: 400 });
  }

  try {
    const file = await getAttachment(account, path, uid, index);
    const asciiName = file.filename.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
    const disposition = `filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`;

    // ?inline=1 (the preview tab): only images, PDF and plain text, recognised
    // by their bytes, are shown in the browser. Everything else -- and any
    // HTML/SVG whatever it claims to be -- is always a download.
    const preview = params.get("inline") === "1" ? detectPreview(file.filename, file.contentType, file.content) : null;
    if (preview && preview.kind !== "sheet") {
      const body = preview.kind === "text" ? Buffer.from(decodeText(file.content), "utf8") : file.content;
      return new Response(new Uint8Array(body), {
        headers: {
          "Content-Type": preview.mime,
          "Content-Disposition": `inline; ${disposition}`,
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private, no-store",
          // The PDF viewer can't run in a sandboxed document; images and text can.
          ...(preview.kind === "pdf" ? {} : { "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" }),
        },
      });
    }

    return new Response(new Uint8Array(file.content), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; ${disposition}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return new Response(error instanceof MailError ? error.message : "Ошибка", { status: 404 });
  }
}
