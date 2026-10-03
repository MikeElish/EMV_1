import "server-only";
import type { MailAccount } from "@/lib/mail/account";
import { listFolders, isMyFolder, type MailFolder } from "@/lib/mail/imap";

export type UnreadCounts = {
  inbox: number;
  folders: number;
  sent: number;
  junk: number;
  drafts: number;
  /** Shown next to «Почта» in the sidebar: Входящие + Мои папки (no Спам). */
  total: number;
};

const TTL_MS = 20 * 1000;
type Entry = { at: number; data: Promise<{ folders: MailFolder[]; counts: UnreadCounts }> };
const globalCache = globalThis as unknown as { __emvMailUnread?: Map<string, Entry> };
const cache: Map<string, Entry> = (globalCache.__emvMailUnread ??= new Map<string, Entry>());

function countsOf(folders: MailFolder[]): UnreadCounts {
  const sum = (pred: (f: MailFolder) => boolean) => folders.filter(pred).reduce((n, f) => n + f.unseen, 0);
  const inbox = sum((f) => f.role === "inbox");
  // Unread letters in Удалённые / Исходящие don't call for attention.
  const folderCount = sum((f) => isMyFolder(f) && f.role !== "trash" && f.role !== "outbox");
  return {
    inbox,
    folders: folderCount,
    sent: sum((f) => f.role === "sent"),
    junk: sum((f) => f.role === "junk"),
    drafts: sum((f) => f.role === "drafts"),
    total: inbox + folderCount,
  };
}

/** Folders with counters, shared by every page/poll for a few seconds. */
export function getFoldersWithCounts(account: MailAccount) {
  const hit = cache.get(account.userId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
  const data = listFolders(account).then((folders) => ({ folders, counts: countsOf(folders) }));
  cache.set(account.userId, { at: Date.now(), data });
  data.catch(() => {
    if (cache.get(account.userId)?.data === data) cache.delete(account.userId);
  });
  return data;
}

export function invalidateUnread(userId: string) {
  cache.delete(userId);
}
