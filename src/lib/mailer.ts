import "server-only";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/secret-box";

export type SiteMail = { to: string; subject: string; text: string; html?: string };

/**
 * Sends an e-mail from the site's own mailbox (Настройки → Почта). Throws
 * if the mailbox isn't configured or the SMTP server rejects the message.
 */
export async function sendSiteMail(mail: SiteMail) {
  const settings = await prisma.mailSettings.findUnique({ where: { id: 1 } });
  if (!settings) throw new Error("Почтовый ящик сайта не настроен");

  const transport = nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort,
    // 465 is implicit TLS; other ports (587) upgrade via STARTTLS.
    secure: settings.smtpPort === 465,
    auth: { user: settings.login, pass: decryptSecret(settings.passwordEnc) },
  });

  await transport.sendMail({
    from: { name: settings.senderName || "EMV", address: settings.senderEmail },
    ...withSignature(mail, settings.senderEmail),
  });
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Every letter of the site ends with the same signature. */
function withSignature(mail: SiteMail, contactEmail: string): SiteMail {
  const text = `${mail.text}

--
С уважением,
команда EMV
emv.one · ${contactEmail}`;
  if (!mail.html) return { ...mail, text };
  const html = `${mail.html}
<div style="font-family:Arial,sans-serif;font-size:14px;color:#555;margin-top:24px;padding-top:12px;border-top:1px solid #e5e5e5">
  <p style="margin:0">С уважением,<br><b style="color:#111">команда EMV</b></p>
  <p style="margin:6px 0 0;font-size:13px"><a href="https://emv.one" style="color:#555">emv.one</a> · <a href="mailto:${escapeHtml(contactEmail)}" style="color:#555">${escapeHtml(contactEmail)}</a></p>
</div>`;
  return { ...mail, text, html };
}
