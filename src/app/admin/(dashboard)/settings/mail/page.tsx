import { prisma } from "@/lib/prisma";
import { MailSettingsTable } from "@/components/admin/MailSettingsTable";

export default async function MailSettingsPage() {
  const [settings, users] = await Promise.all([
    prisma.mailSettings.findUnique({ where: { id: 1 } }),
    prisma.user.findMany({
      where: { role: { not: "CUSTOMER" } },
      select: {
        id: true,
        lastName: true,
        firstName: true,
        login: true,
        role: true,
        mailLogin: true,
        mailPasswordEnc: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Stored passwords never leave the server -- the client only learns
  // whether one is set.
  const site = settings && {
    smtpHost: settings.smtpHost,
    smtpPort: settings.smtpPort,
    imapHost: settings.imapHost,
    imapPort: settings.imapPort,
    login: settings.login,
    senderEmail: settings.senderEmail,
    senderName: settings.senderName ?? "",
  };

  return (
    <MailSettingsTable
      site={site}
      users={users.map(({ mailPasswordEnc, ...user }) => ({
        ...user,
        hasPassword: !!mailPasswordEnc,
      }))}
    />
  );
}
