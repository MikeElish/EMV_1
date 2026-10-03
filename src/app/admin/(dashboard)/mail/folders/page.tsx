import Link from "next/link";
import { verifyStaffSession } from "@/lib/staff-dal";
import { getMailAccount } from "@/lib/mail/account";
import { isMyFolder, MailError } from "@/lib/mail/imap";
import { getFoldersWithCounts } from "@/lib/mail/unread";
import { MailErrorBox, MailFolderPage, pageFromSearch } from "@/components/mail/MailPages";
import { UnreadLabel } from "@/components/mail/UnreadLabel";

export default async function MyFoldersPage({ searchParams }: PageProps<"/admin/mail/folders">) {
  const { userId } = await verifyStaffSession();
  const account = await getMailAccount(userId);
  if (!account) return null;

  let folders;
  try {
    folders = (await getFoldersWithCounts(account)).folders.filter(isMyFolder);
  } catch (error) {
    return <MailErrorBox message={error instanceof MailError ? error.message : "Не удалось загрузить почту"} />;
  }

  const { path, page } = await searchParams;
  const current = folders.find((f) => f.path === path) ?? folders[0];

  return (
    <div className="flex gap-6">
      <nav className="w-52 shrink-0 space-y-1 text-sm" aria-label="Мои папки">
        {folders.map((f) => (
          <Link
            key={f.path}
            prefetch={false}
            href={`/admin/mail/folders?path=${encodeURIComponent(f.path)}`}
            className={`block truncate rounded-md px-3 py-1.5 transition-colors hover:bg-foreground/5 ${
              f.path === current?.path ? "bg-foreground/5 text-foreground" : "text-foreground/70"
            }`}
          >
            <UnreadLabel label={f.name} count={f.role === "trash" || f.role === "outbox" ? 0 : f.unseen} />
          </Link>
        ))}
        <Link
          prefetch={false}
          href="/admin/mail/settings?section=folders"
          className="mt-3 block px-3 text-xs text-foreground/50 underline underline-offset-4 hover:text-foreground"
        >
          Создать папку
        </Link>
      </nav>

      <div className="min-w-0 flex-1">
        {current ? (
          <MailFolderPage
            path={current.path}
            basePath={`/admin/mail/folders?path=${encodeURIComponent(current.path)}`}
            page={pageFromSearch(page)}
          />
        ) : (
          <p className="py-10 text-center text-sm text-foreground/40">
            Своих папок пока нет — их можно создать в Настройках → Папки
          </p>
        )}
      </div>
    </div>
  );
}
