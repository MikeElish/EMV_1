import "server-only";
import Link from "next/link";
import { notFound } from "next/navigation";
import { verifyStaffSession } from "@/lib/staff-dal";
import { getMailAccount } from "@/lib/mail/account";
import { folderByRole, isMyFolder, MailError, type FolderRole, type MailFolder } from "@/lib/mail/imap";
import { getFoldersWithCounts, invalidateUnread } from "@/lib/mail/unread";
import { listMessages, getMessage } from "@/lib/mail/messages";
import { MessageList } from "@/components/mail/MessageList";
import { MessageReader } from "@/components/mail/MessageReader";

export type TabRole = Extract<FolderRole, "inbox" | "sent" | "junk" | "drafts">;

export function MailErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-5 text-sm">
      <p className="text-red-600">{message}</p>
      <Link href="/admin/mail/settings?section=programs" className="mt-3 inline-block underline underline-offset-4">
        Почта → Настройки → Почтовые программы
      </Link>
    </div>
  );
}

/** Folder pickers in the toolbar ("В папку"): everything but the current one. */
function moveTargets(folders: MailFolder[], current: string) {
  return folders
    .filter((f) => f.path !== current && f.role !== "drafts" && f.role !== "outbox")
    .map((f) => ({ path: f.path, name: f.name }));
}

async function loadAccount() {
  const { userId } = await verifyStaffSession();
  return getMailAccount(userId);
}

function errorText(error: unknown) {
  if (error instanceof MailError) return error.message;
  console.error("[mail] page failed:", error);
  return "Не удалось загрузить почту";
}

export async function MailFolderPage({
  role,
  path,
  basePath,
  page,
  heading,
}: {
  role?: TabRole;
  /** For Мои папки: the folder chosen in the list. */
  path?: string;
  basePath: string;
  page: number;
  heading?: React.ReactNode;
}) {
  const account = await loadAccount();
  if (!account) return null; // MailShell shows «Почта не настроена»

  let result: {
    folders: MailFolder[];
    folder: MailFolder;
    data: Awaited<ReturnType<typeof listMessages>>;
  } | null = null;
  let failure: string | null = null;

  try {
    const { folders } = await getFoldersWithCounts(account);
    const folder = role ? folderByRole(folders, role) : folders.find((f) => f.path === path && isMyFolder(f));
    if (folder) result = { folders, folder, data: await listMessages(account, folder.path, page) };
  } catch (error) {
    failure = errorText(error);
  }

  if (!result) return <MailErrorBox message={failure ?? "Такой папки нет в почтовом ящике"} />;

  return (
    <>
      {heading}
      <MessageList
        folder={{ path: result.folder.path, role: result.folder.role, name: result.folder.name }}
        basePath={basePath}
        data={result.data}
        moveTargets={moveTargets(result.folders, result.folder.path)}
      />
    </>
  );
}

export async function MailMessagePage({
  role,
  path,
  uid,
  basePath,
}: {
  role?: TabRole;
  path?: string;
  uid: string;
  basePath: string;
}) {
  const account = await loadAccount();
  if (!account) return null;
  const uidNumber = Number(uid);
  if (!Number.isInteger(uidNumber) || uidNumber <= 0) notFound();

  let result: {
    folders: MailFolder[];
    folder: MailFolder;
    message: Awaited<ReturnType<typeof getMessage>>;
  } | null = null;
  let failure: string | null = null;

  try {
    const { folders } = await getFoldersWithCounts(account);
    const folder = role ? folderByRole(folders, role) : folders.find((f) => f.path === path);
    if (folder) {
      const message = await getMessage(account, folder.path, uidNumber, folder.role !== "drafts");
      // Opening a letter marks it read -- the counters must not lag behind.
      invalidateUnread(account.userId);
      result = { folders, folder, message };
    }
  } catch (error) {
    failure = errorText(error);
  }

  if (!result) return <MailErrorBox message={failure ?? "Такой папки нет в почтовом ящике"} />;

  return (
    <MessageReader
      folder={{ path: result.folder.path, role: result.folder.role, name: result.folder.name }}
      basePath={basePath}
      message={result.message}
      moveTargets={moveTargets(result.folders, result.folder.path)}
    />
  );
}

export function pageFromSearch(value: string | string[] | undefined) {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}
