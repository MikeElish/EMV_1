import "server-only";
import { createHash } from "crypto";
import { ImapFlow, type ListResponse } from "imapflow";
import type { MailAccount } from "@/lib/mail/account";

export class MailError extends Error {}

const IDLE_CLOSE_MS = 2 * 60 * 1000;

type PoolEntry = { key: string; client: Promise<ImapFlow>; timer?: NodeJS.Timeout };

// One IMAP connection per employee, kept for a couple of minutes so that
// opening folders and letters doesn't pay for a TLS handshake + login each
// time. Survives dev hot reloads via globalThis.
const globalPool = globalThis as unknown as { __emvImapPool?: Map<string, PoolEntry> };
const pool: Map<string, PoolEntry> = (globalPool.__emvImapPool ??= new Map<string, PoolEntry>());

function accountKey(account: MailAccount) {
  return createHash("sha256")
    .update(`${account.imapHost}:${account.imapPort}:${account.login}:${account.password}`)
    .digest("hex");
}

function drop(userId: string, entry: PoolEntry) {
  if (pool.get(userId) !== entry) return;
  pool.delete(userId);
  clearTimeout(entry.timer);
  entry.client.then((c) => c.logout().catch(() => c.close())).catch(() => {});
}

function describeError(error: unknown): string {
  const e = error as { authenticationFailed?: boolean; responseText?: string; code?: string; message?: string };
  if (e?.authenticationFailed || /AUTHENTICATE|LOGIN|credentials/i.test(e?.responseText ?? "")) {
    return "Не удалось войти в почтовый ящик. Проверьте логин и пароль приложения в Почта → Настройки → Почтовые программы и что в Яндекс.Почте включён доступ по IMAP.";
  }
  if (e?.code === "ETIMEDOUT" || e?.code === "ECONNREFUSED" || e?.code === "ENOTFOUND") {
    return "Почтовый сервер недоступен. Попробуйте позже.";
  }
  return "Ошибка почтового сервера: " + (e?.responseText || e?.message || "неизвестная ошибка");
}

async function getClient(account: MailAccount): Promise<ImapFlow> {
  const key = accountKey(account);
  let entry = pool.get(account.userId);
  if (entry && entry.key !== key) {
    drop(account.userId, entry);
    entry = undefined;
  }
  if (entry) {
    const existing = await entry.client.catch(() => null);
    if (existing?.usable) {
      clearTimeout(entry.timer);
      entry.timer = setTimeout(() => drop(account.userId, entry!), IDLE_CLOSE_MS);
      return existing;
    }
    drop(account.userId, entry);
  }

  const client = new ImapFlow({
    host: account.imapHost,
    port: account.imapPort,
    secure: account.imapPort === 993,
    auth: { user: account.login, pass: account.password },
    logger: false,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
  });
  const fresh: PoolEntry = { key, client: client.connect().then(() => client) };
  pool.set(account.userId, fresh);
  client.on("error", () => drop(account.userId, fresh));
  client.on("close", () => drop(account.userId, fresh));
  try {
    await fresh.client;
  } catch (error) {
    drop(account.userId, fresh);
    throw new MailError(describeError(error));
  }
  fresh.timer = setTimeout(() => drop(account.userId, fresh), IDLE_CLOSE_MS);
  return client;
}

/** Runs `fn` on the employee's pooled connection; IMAP failures become MailError. */
export async function withImap<T>(account: MailAccount, fn: (client: ImapFlow) => Promise<T>): Promise<T> {
  const client = await getClient(account);
  try {
    return await fn(client);
  } catch (error) {
    if (error instanceof MailError) throw error;
    console.error("[mail] imap operation failed:", error);
    throw new MailError(describeError(error));
  }
}

/** Same, with the folder selected (and locked against parallel selects). */
export async function withFolder<T>(
  account: MailAccount,
  path: string,
  fn: (client: ImapFlow) => Promise<T>
): Promise<T> {
  return withImap(account, async (client) => {
    const lock = await client.getMailboxLock(path);
    try {
      return await fn(client);
    } finally {
      lock.release();
    }
  });
}

// ---- Folders ---------------------------------------------------------------

export type FolderRole = "inbox" | "sent" | "drafts" | "junk" | "trash" | "archive" | "outbox" | "custom";

export type MailFolder = {
  path: string;
  name: string;
  role: FolderRole;
  unseen: number;
  messages: number;
};

const SPECIAL_USE: Record<string, FolderRole> = {
  "\\Inbox": "inbox",
  "\\Sent": "sent",
  "\\Drafts": "drafts",
  "\\Junk": "junk",
  "\\Trash": "trash",
  "\\Archive": "archive",
};

// Fallback for servers without SPECIAL-USE (Yandex uses these paths).
const BY_PATH: Record<string, FolderRole> = {
  inbox: "inbox",
  sent: "sent",
  drafts: "drafts",
  spam: "junk",
  junk: "junk",
  trash: "trash",
  archive: "archive",
  outbox: "outbox",
};

export const FOLDER_ROLE_LABELS: Record<Exclude<FolderRole, "custom">, string> = {
  inbox: "Входящие",
  sent: "Отправленные",
  drafts: "Черновики",
  junk: "Спам",
  trash: "Удалённые",
  archive: "Архив",
  outbox: "Исходящие",
};

function roleOf(folder: ListResponse): FolderRole {
  if (folder.path.toUpperCase() === "INBOX") return "inbox";
  if (folder.specialUse && SPECIAL_USE[folder.specialUse]) return SPECIAL_USE[folder.specialUse];
  return BY_PATH[folder.path.toLowerCase()] ?? "custom";
}

export async function listFolders(account: MailAccount): Promise<MailFolder[]> {
  return withImap(account, async (client) => {
    const list = await client.list({ statusQuery: { messages: true, unseen: true } });
    return list
      .filter((f) => !f.flags?.has("\\Noselect") && !f.flags?.has("\\NonExistent"))
      .map((f) => {
        const role = roleOf(f);
        return {
          path: f.path,
          name:
            role === "custom"
              ? f.path.split(f.delimiter || "/").join(" / ")
              : FOLDER_ROLE_LABELS[role],
          role,
          unseen: f.status?.unseen ?? 0,
          messages: f.status?.messages ?? 0,
        };
      });
  });
}

export function folderByRole(folders: MailFolder[], role: Exclude<FolderRole, "custom">) {
  return folders.find((f) => f.role === role) ?? null;
}

/** "Мои папки" = everything except the four folders that have their own tab. */
export function isMyFolder(folder: MailFolder) {
  return !["inbox", "sent", "drafts", "junk"].includes(folder.role);
}
