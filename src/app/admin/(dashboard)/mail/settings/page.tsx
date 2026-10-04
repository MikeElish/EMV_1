import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { verifyStaffSession } from "@/lib/staff-dal";
import { getMailAccount } from "@/lib/mail/account";
import { MailError, listFolders, type MailFolder } from "@/lib/mail/imap";
import { MailRulesSettings, type RuleRow } from "@/components/mail/MailRulesSettings";
import { getFoldersWithCounts } from "@/lib/mail/unread";
import { MAIL_DEFAULTS } from "@/lib/validators/mail-settings";
import { getSignatureLogoDataUri } from "@/lib/mail/signature-logo";
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
  { id: "rules", label: "Правила обработки писем" },
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

  let rules: RuleRow[] = [];
  let ruleFolders: { path: string; name: string }[] = [];
  let ruleFoldersError: string | null = null;
  if (section === "rules" && account) {
    rules = (await prisma.mailRule.findMany({ where: { userId }, orderBy: { position: "asc" } })).map((r) => ({
      id: r.id,
      name: r.name,
      enabled: r.enabled,
      matchAll: r.matchAll,
      conditions: r.conditions as RuleRow["conditions"],
      attachments: r.attachments as RuleRow["attachments"],
      moveTo: r.moveTo,
      markRead: r.markRead,
      flag: r.flag,
      remove: r.remove,
      forwardTo: r.forwardTo,
      replyText: r.replyText,
      stopProcessing: r.stopProcessing,
    }));
    try {
      // Where a rule may put a letter: everything but Входящие, Черновики, Исходящие.
      ruleFolders = (await listFolders(account))
        .filter((f) => !["inbox", "drafts", "outbox"].includes(f.role))
        .map((f) => ({ path: f.path, name: f.name }));
    } catch (error) {
      ruleFoldersError = error instanceof MailError ? error.message : "Не удалось загрузить папки";
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

      {/* The signature section is wider: the preview sits to the right of the form. */}
      <div
        className={`min-w-0 flex-1 ${
          section === "personal" ? "max-w-6xl" : section === "rules" ? "max-w-4xl" : "max-w-xl"
        }`}
      >
        {section === "personal" && (
          <PersonalSettings
            senderName={user?.mailSenderName ?? ""}
            signature={user?.mailSignature ?? ""}
            pageSize={user?.mailPageSize ?? 30}
            logo={await getSignatureLogoDataUri(userId)}
          />
        )}
        {section === "folders" &&
          (account ? (
            <FoldersSettings folders={folders} error={foldersError} />
          ) : (
            <p className="text-sm text-foreground/60">Сначала подключите ящик в разделе «Почтовые программы».</p>
          ))}
        {section === "rules" &&
          (account ? (
            <MailRulesSettings rules={rules} folders={ruleFolders} foldersError={ruleFoldersError} />
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
