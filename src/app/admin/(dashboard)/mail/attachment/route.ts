import { getStaffSession } from "@/lib/staff-dal";
import { getMailAccount } from "@/lib/mail/account";
import { getAttachment } from "@/lib/mail/messages";
import { MailError } from "@/lib/mail/imap";

/** Downloads one attachment of a letter in the employee's own mailbox. */
export async function GET(request: Request) {
  const session = await getStaffSession();
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
    return new Response(new Uint8Array(file.content), {
      headers: {
        // Always a download: an HTML attachment must never render on our origin.
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return new Response(error instanceof MailError ? error.message : "Ошибка", { status: 404 });
  }
}
