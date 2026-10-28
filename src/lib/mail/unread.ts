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
type Data = { folders: MailFolder[]; counts: UnreadCounts };
// `data` -- the last good result; `refresh` -- a new reading under way.
type Entry = { at: number; data: Promise<Data>; refresh?: Promise<Data> };
const globalCache = globalThis as unknown as { __emvMailUnread?: Map<string, Entry> };
const cache: Map<string, Entry> = (globalCache.__emvMailUnread ??= new Map<string, Entry>());

// Unread letters in Удалённые / Исходящие don't call for attention.
const attentionFolder = (f: MailFolder) => isMyFolder(f) && f.role !== "trash" && f.role !== "outbox";

/** Where new letters call for attention: Входящие + Мои папки (the «Почта» counter; the Windows program's notifications). */
export const isWatchedFolder = (f: MailFolder) => f.role === "inbox" || attentionFolder(f);

function countsOf(folders: MailFolder[]): UnreadCounts {
  const sum = (pred: (f: MailFolder) => boolean) => folders.filter(pred).reduce((n, f) => n + f.unseen, 0);
  const inbox = sum((f) => f.role === "inbox");
  const folderCount = sum(attentionFolder);
  return {
    inbox,
    folders: folderCount,
    sent: sum((f) => f.role === "sent"),
    junk: sum((f) => f.role === "junk"),
    drafts: sum((f) => f.role === "drafts"),
    total: inbox + folderCount,
  };
}

/**
 * Folders with counters. Asking the server takes seconds (a STATUS per
 * folder), so pages get the last reading at once and a new one is made in the
 * background when it is older than a few seconds. `wait` (the counters'
 * poll) waits for a reading under way instead.
 */
export function getFoldersWithCounts(account: MailAccount, { wait = false }: { wait?: boolean } = {}): Promise<Data> {
  const hit = cache.get(account.userId);
  if (hit && Date.now() - hit.at < TTL_MS) return wait && hit.refresh ? hit.refresh : hit.data;
  if (hit) {
    const refresh = hit.refresh ?? readFolders(account, hit);
    return wait ? refresh : hit.data;
  }
  const entry: Entry = { at: Date.now(), data: Promise.resolve() as unknown as Promise<Data> };
  entry.data = readFolders(account, entry);
  cache.set(account.userId, entry);
  entry.data.catch(() => {
    if (cache.get(account.userId) === entry) cache.delete(account.userId);
  });
  return entry.data;
}

function readFolders(account: MailAccount, entry: Entry): Promise<Data> {
  const reading = listFolders(account).then((folders) => ({ folders, counts: countsOf(folders) }));
  entry.refresh = reading;
  reading
    .then(() => {
      entry.data = reading;
      entry.at = Date.now();
    })
    .catch(() => {})
    .finally(() => {
      if (entry.refresh === reading) entry.refresh = undefined;
    });
  return reading;
}

/** Letters were read, moved, sent: the counters are re-read now (pages keep the last ones meanwhile). */
export function invalidateUnread(userId: string) {
  const hit = cache.get(userId);
  if (hit) hit.at = 0;
}

/** Folders were created, renamed or deleted: the next page waits for the new list. */
export function forgetFolders(userId: string) {
  cache.delete(userId);
}
