import "server-only";
import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer";
import type Mail from "nodemailer/lib/mailer";
import type { MailAccount } from "@/lib/mail/account";
import { withImap, withFolder, listFolders, folderByRole, MailError } from "@/lib/mail/imap";
import { getParsedMessage } from "@/lib/mail/messages";

export type OutgoingMail = {
  to: string[];
  cc: string[];
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string[];
  files: File[];
  /** Carry over the attachments of this message (forward / reopened draft). */
  attachFrom?: { path: string; uid: number };
};

function escapeHtml(text: string) {
  return text.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
}

async function buildRaw(account: MailAccount, mail: OutgoingMail): Promise<{ raw: Buffer; messageId: string }> {
  const attachments: Mail.Attachment[] = [];
  for (const file of mail.files) {
    attachments.push({
      filename: file.name,
      contentType: file.type || undefined,
      content: Buffer.from(await file.arrayBuffer()),
    });
  }
  if (mail.attachFrom) {
    const original = await getParsedMessage(account, mail.attachFrom.path, mail.attachFrom.uid);
    for (const att of original.attachments) {
      if (att.related) continue;
      attachments.push({ filename: att.filename, contentType: att.contentType, content: att.content });
    }
  }

  const composer = new MailComposer({
    from: { name: account.senderName, address: account.login },
    to: mail.to,
    cc: mail.cc.length ? mail.cc : undefined,
    subject: mail.subject,
    text: mail.body,
    html: `<div style="white-space:pre-wrap;font-family:Arial,sans-serif;font-size:14px">${escapeHtml(mail.body)}</div>`,
    inReplyTo: mail.inReplyTo,
    references: mail.references?.length ? mail.references : undefined,
    attachments,
  });
  const node = composer.compile();
  const raw = await new Promise<Buffer>((resolve, reject) =>
    node.build((err, message) => (err ? reject(err) : resolve(message)))
  );
  return { raw, messageId: String(node.messageId()) };
}

const bareAddress = (item: string) => (item.match(/<([^>]+)>\s*$/)?.[1] ?? item).trim();

export async function sendOutgoing(account: MailAccount, mail: OutgoingMail) {
  const { raw, messageId } = await buildRaw(account, mail);

  const transport = nodemailer.createTransport({
    host: account.smtpHost,
    port: account.smtpPort,
    secure: account.smtpPort === 465,
    auth: { user: account.login, pass: account.password },
  });
  try {
    await transport.sendMail({
      envelope: { from: account.login, to: [...mail.to, ...mail.cc].map(bareAddress) },
      raw,
    });
  } catch (error) {
    const e = error as { code?: string; response?: string; message?: string };
    console.error("[mail] smtp send failed:", error);
    throw new MailError(
      e.code === "EAUTH"
        ? "Почтовый сервер не принял логин или пароль приложения"
        : "Письмо не отправлено: " + (e.response || e.message || "ошибка сервера")
    );
  }

  // Yandex can store SMTP-sent letters in Отправленные itself (a mailbox
  // setting); add the copy only if it isn't there.
  try {
    const sent = folderByRole(await listFolders(account), "sent");
    if (sent) {
      await new Promise((r) => setTimeout(r, 1500));
      const already = await withFolder(account, sent.path, async (client) => {
        const found = await client.search({ header: { "message-id": messageId } }, { uid: true });
        return Array.isArray(found) && found.length > 0;
      });
      if (!already) {
        await withImap(account, (client) => client.append(sent.path, raw, ["\\Seen"]));
      }
    }
  } catch (error) {
    // The letter is already sent -- a missing copy isn't worth failing over.
    console.error("[mail] could not store sent copy:", error);
  }
}

/** Saves to Черновики, replacing the previous version of the same draft. */
export async function saveDraftMessage(
  account: MailAccount,
  mail: OutgoingMail,
  replaceUid?: number
): Promise<{ uid: number | null; path: string }> {
  const drafts = folderByRole(await listFolders(account), "drafts");
  if (!drafts) throw new MailError("В ящике нет папки «Черновики»");
  const { raw } = await buildRaw(account, mail);
  const result = await withImap(account, (client) => client.append(drafts.path, raw, ["\\Draft", "\\Seen"]));
  if (replaceUid) await deleteDraft(account, replaceUid);
  return { uid: result ? (result.uid ?? null) : null, path: drafts.path };
}

export async function deleteDraft(account: MailAccount, uid: number) {
  const drafts = folderByRole(await listFolders(account), "drafts");
  if (!drafts) return;
  await withFolder(account, drafts.path, (client) => client.messageDelete(String(uid), { uid: true }));
}
