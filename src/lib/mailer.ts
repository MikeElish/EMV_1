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
    ...mail,
  });
}
