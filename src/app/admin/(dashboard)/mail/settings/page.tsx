import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { verifyStaffSession } from "@/lib/staff-dal";
import { getMailAccount } from "@/lib/mail/account";
import { MailError, type MailFolder } from "@/lib/mail/imap";
import { getFoldersWithCounts } from "@/lib/mail/unread";
import { MAIL_DEFAULTS } from "@/lib/validators/mail-settings";
import {
  FoldersSettings,
  OtherSettings,
  PersonalSettings,
  ProgramsSettings,
} from "@/components/mail/MailSettingsForms";

// Mirrors Яндекс.Почта → «Все настройки», limited to what works over IMAP/SMTP.
const SECTIONS = [
  { id: "personal", label: "Личные данные, подпись" },
  { id: "folders", label: "Папки" },
  { id: "programs", label: "Почтовые программы" },
  { id: "other", label: "Прочее" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

export default async function MailSettingsPage({ searchParams }: PageProps<"/admin/mail/settings">) {
  const { userId, role } = await verifyStaffSession();
  const { section: rawSection } = await searchParams;
  const account = await getMailAccount(userId);
  const section: SectionId =
    SECTIONS.find((s) => s.id === rawSection)?.id ?? (account ? "personal" : "programs");

  const [user, settings] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { mailLogin: true, mailPasswordEnc: true, mailSenderName: true, mailSignature: true, mailPageSize: true },
    }),
    prisma.mailSettings.findUnique({ where: { id: 1 } }),
  ]);

  let folders: MailFolder[] | null = null;
  let foldersError: string | null = null;
  if (section === "folders" && account) {
    try {
      folders = (await getFoldersWithCounts(account)).folders;
    } catch (error) {
      foldersError = error instanceof MailError ? error.message : "Не удалось загрузить папки";
    }
  }

  return (
    <div className="flex gap-8">
      <nav className="w-56 shrink-0 space-y-1 text-sm" aria-label="Разделы настроек">
        {SECTIONS.map((s) => (
          <Link
            key={s.id}
            href={`/admin/mail/settings?section=${s.id}`}
            prefetch={false}
            className={`block rounded-md px-3 py-1.5 transition-colors hover:bg-foreground/5 ${
              s.id === section ? "bg-foreground/5 font-medium text-foreground" : "text-foreground/70"
            }`}
          >
            {s.label}
          </Link>
        ))}
      </nav>

      <div className="min-w-0 max-w-xl flex-1">
        {section === "personal" && (
          <PersonalSettings
            senderName={user?.mailSenderName ?? ""}
            signature={user?.mailSignature ?? ""}
            pageSize={user?.mailPageSize ?? 30}
          />
        )}
        {section === "folders" &&
          (account ? (
            <FoldersSettings folders={folders} error={foldersError} />
          ) : (
            <p className="text-sm text-foreground/60">Сначала подключите ящик в разделе «Почтовые программы».</p>
          ))}
        {section === "programs" && (
          <ProgramsSettings
            login={user?.mailLogin ?? ""}
            hasPassword={!!user?.mailPasswordEnc}
            servers={{
              imapHost: settings?.imapHost ?? MAIL_DEFAULTS.imapHost,
              imapPort: settings?.imapPort ?? MAIL_DEFAULTS.imapPort,
              smtpHost: settings?.smtpHost ?? MAIL_DEFAULTS.smtpHost,
              smtpPort: settings?.smtpPort ?? MAIL_DEFAULTS.smtpPort,
            }}
            isOwner={role === "OWNER"}
          />
        )}
        {section === "other" && (
          <OtherSettings
            senderName={user?.mailSenderName ?? ""}
            signature={user?.mailSignature ?? ""}
            pageSize={user?.mailPageSize ?? 30}
          />
        )}
      </div>
    </div>
  );
}
