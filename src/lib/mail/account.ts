import "server-only";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/secret-box";
import { MAIL_DEFAULTS } from "@/lib/validators/mail-settings";

export type MailAccount = {
  userId: string;
  login: string;
  password: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  senderName: string;
  signature: string;
  pageSize: number;
};

/**
 * The signed-in employee's own mailbox: credentials are per user, servers
 * come from Настройки → Почта (Yandex defaults until the owner saves them).
 * Null when the user hasn't entered a login and password yet.
 */
export async function getMailAccount(userId: string): Promise<MailAccount | null> {
  const [user, settings] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        mailLogin: true,
        mailPasswordEnc: true,
        mailSenderName: true,
        mailSignature: true,
        mailPageSize: true,
      },
    }),
    prisma.mailSettings.findUnique({ where: { id: 1 } }),
  ]);
  if (!user?.mailLogin || !user.mailPasswordEnc) return null;

  let password: string;
  try {
    password = decryptSecret(user.mailPasswordEnc);
  } catch {
    // SESSION_SECRET rotated -- the stored password is unreadable.
    return null;
  }

  return {
    userId,
    login: user.mailLogin,
    password,
    imapHost: settings?.imapHost ?? MAIL_DEFAULTS.imapHost,
    imapPort: settings?.imapPort ?? MAIL_DEFAULTS.imapPort,
    smtpHost: settings?.smtpHost ?? MAIL_DEFAULTS.smtpHost,
    smtpPort: settings?.smtpPort ?? MAIL_DEFAULTS.smtpPort,
    senderName:
      user.mailSenderName || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.mailLogin,
    signature: user.mailSignature ?? "",
    pageSize: user.mailPageSize,
  };
}
