import "server-only";
import { simpleParser, type AddressObject, type ParsedMail } from "mailparser";
import sanitizeHtml from "sanitize-html";
import type { MessageStructureObject } from "imapflow";
import type { MailAccount } from "@/lib/mail/account";
import { withFolder, MailError } from "@/lib/mail/imap";

export type MailAddress = { name: string; address: string };

export type MessageSummary = {
  uid: number;
  seen: boolean;
  flagged: boolean;
  from: MailAddress[];
  to: MailAddress[];
  subject: string;
  date: string | null;
  hasAttachments: boolean;
};

export type MessagePage = {
  total: number;
  page: number;
  pages: number;
  items: MessageSummary[];
};

function hasAttachment(node: MessageStructureObject | undefined): boolean {
  if (!node) return false;
  if (node.disposition === "attachment") return true;
  if (node.dispositionParameters?.filename && node.disposition !== "inline") return true;
  return (node.childNodes ?? []).some(hasAttachment);
}

const toAddresses = (list?: { name?: string; address?: string }[]): MailAddress[] =>
  (list ?? []).map((a) => ({ name: a.name ?? "", address: a.address ?? "" }));

/** Newest first, `pageSize` per page (sequence numbers, so no full scan). */
export async function listMessages(
  account: MailAccount,
  path: string,
  page: number
): Promise<MessagePage> {
  return withFolder(account, path, async (client) => {
    const total = client.mailbox ? client.mailbox.exists : 0;
    const size = account.pageSize;
    const pages = Math.max(1, Math.ceil(total / size));
    const current = Math.min(Math.max(1, page), pages);
    if (total === 0) return { total, page: 1, pages: 1, items: [] };

    const end = total - (current - 1) * size;
    const start = Math.max(1, end - size + 1);
    const items: MessageSummary[] = [];
    for await (const msg of client.fetch(`${start}:${end}`, {
      uid: true,
      flags: true,
      envelope: true,
      bodyStructure: true,
      internalDate: true,
    })) {
      items.push({
        uid: msg.uid,
        seen: msg.flags?.has("\\Seen") ?? false,
        flagged: msg.flags?.has("\\Flagged") ?? false,
        from: toAddresses(msg.envelope?.from),
        to: toAddresses(msg.envelope?.to),
        subject: msg.envelope?.subject || "(без темы)",
        date: (msg.envelope?.date ?? msg.internalDate)
          ? new Date((msg.envelope?.date ?? msg.internalDate) as Date | string).toISOString()
          : null,
        hasAttachments: hasAttachment(msg.bodyStructure),
      });
    }
    items.sort((a, b) => b.uid - a.uid);
    return { total, page: current, pages, items };
  });
}

// ---- Single message --------------------------------------------------------

export type MessageDetail = {
  uid: number;
  subject: string;
  from: MailAddress[];
  to: MailAddress[];
  cc: MailAddress[];
  replyTo: MailAddress[];
  date: string | null;
  messageId: string | null;
  references: string[];
  /** Sanitised HTML document, rendered in a sandboxed iframe. */
  html: string;
  text: string;
  attachments: { index: number; filename: string; contentType: string; size: number }[];
};

const flatten = (value?: AddressObject | AddressObject[]): MailAddress[] =>
  (Array.isArray(value) ? value : value ? [value] : []).flatMap((group) =>
    group.value.map((a) => ({ name: a.name ?? "", address: a.address ?? "" }))
  );

const SAFE_ATTRIBUTES = [
  "style", "class", "id", "align", "valign", "width", "height", "bgcolor", "background", "border",
  "cellpadding", "cellspacing", "colspan", "rowspan", "dir", "lang", "title", "color", "face", "size",
];

function escapeHtml(text: string) {
  return text.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
}

function buildHtml(parsed: ParsedMail): string {
  // Inline images (cid:) are embedded as data: URIs so the iframe needs no
  // authenticated requests.
  const inline = new Map<string, string>();
  for (const att of parsed.attachments) {
    if (att.cid && att.contentType.startsWith("image/") && att.size < 2 * 1024 * 1024) {
      inline.set(att.cid, `data:${att.contentType};base64,${att.content.toString("base64")}`);
    }
  }

  let body: string;
  if (parsed.html) {
    body = sanitizeHtml(parsed.html.replace(/cid:([^"'\s)>]+)/gi, (m, cid) => inline.get(cid) ?? m), {
      allowedTags: [...sanitizeHtml.defaults.allowedTags, "img", "style", "font", "center", "span", "u", "s"],
      allowVulnerableTags: true, // <style> -- harmless inside the script-less sandbox
      allowedAttributes: {
        "*": SAFE_ATTRIBUTES,
        a: ["href", "name", "target", ...SAFE_ATTRIBUTES],
        img: ["src", "alt", ...SAFE_ATTRIBUTES],
      },
      allowedSchemes: ["http", "https", "mailto", "tel"],
      allowedSchemesByTag: { img: ["http", "https", "data"] },
    });
  } else {
    body = `<pre style="white-space:pre-wrap;font:14px/1.5 system-ui,sans-serif;margin:0">${escapeHtml(parsed.text ?? "")}</pre>`;
  }

  return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank">
<style>body{margin:0;padding:16px;font:14px/1.5 system-ui,sans-serif;color:#111;background:#fff;word-wrap:break-word}img{max-width:100%;height:auto}</style>
</head><body>${body}</body></html>`;
}

async function fetchParsed(account: MailAccount, path: string, uid: number, markSeen: boolean) {
  return withFolder(account, path, async (client) => {
    const msg = await client.fetchOne(String(uid), { uid: true, source: true }, { uid: true });
    if (!msg || !msg.source) throw new MailError("Письмо не найдено — возможно, оно перемещено или удалено");
    if (markSeen) await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
    return simpleParser(msg.source);
  });
}

export async function getMessage(
  account: MailAccount,
  path: string,
  uid: number,
  markSeen: boolean
): Promise<MessageDetail> {
  const parsed = await fetchParsed(account, path, uid, markSeen);
  const refs = parsed.references;
  return {
    uid,
    subject: parsed.subject || "(без темы)",
    from: flatten(parsed.from),
    to: flatten(parsed.to),
    cc: flatten(parsed.cc),
    replyTo: flatten(parsed.replyTo),
    date: parsed.date ? parsed.date.toISOString() : null,
    messageId: parsed.messageId ?? null,
    references: Array.isArray(refs) ? refs : refs ? [refs] : [],
    html: buildHtml(parsed),
    text: parsed.text ?? (parsed.html ? sanitizeHtml(parsed.html, { allowedTags: [], allowedAttributes: {} }) : ""),
    attachments: parsed.attachments
      .map((a, index) => ({
        index,
        filename: a.filename || `Вложение ${index + 1}`,
        contentType: a.contentType,
        size: a.size,
        related: a.related || (!!a.cid && a.contentDisposition === "inline"),
      }))
      .filter((a) => !a.related)
      .map(({ related: _related, ...a }) => a),
  };
}

export async function getAttachment(account: MailAccount, path: string, uid: number, index: number) {
  const parsed = await fetchParsed(account, path, uid, false);
  const att = parsed.attachments[index];
  if (!att) throw new MailError("Вложение не найдено");
  return { filename: att.filename || `attachment-${index + 1}`, contentType: att.contentType, content: att.content };
}

/** Raw RFC 822 source, e.g. to forward a draft's attachments on send. */
export async function getParsedMessage(account: MailAccount, path: string, uid: number) {
  return fetchParsed(account, path, uid, false);
}
