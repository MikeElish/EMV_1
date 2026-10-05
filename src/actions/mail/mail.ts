"use server";

import { revalidatePath } from "next/cache";
import { getStaffSession } from "@/lib/staff-dal";
import type { AccessLevel } from "@/lib/access";
import { getMailAccount, type MailAccount } from "@/lib/mail/account";
import { withFolder, withImap, folderByRole, MailError, type FolderRole } from "@/lib/mail/imap";
import { getFoldersWithCounts, invalidateUnread, type UnreadCounts } from "@/lib/mail/unread";
import { sendOutgoing, saveDraftMessage, deleteDraft, type OutgoingMail } from "@/lib/mail/compose";
import { parseRecipients, folderNameSchema, MAX_ATTACHMENTS_BYTES } from "@/lib/validators/mail";

export type MailActionResult = { ok: true } | { ok: false; error: string };

async function requireAccount(level: AccessLevel = "edit"): Promise<{ account: MailAccount } | { error: string }> {
  const session = await getStaffSession(level);
  if (!session) return { error: level === "edit" ? "Нет прав на изменения в Почте — только просмотр" : "Требуется вход" };
  const account = await getMailAccount(session.userId);
  if (!account) return { error: "Почта не настроена" };
  return { account };
}

function fail(error: unknown): { ok: false; error: string } {
  if (error instanceof MailError) return { ok: false, error: error.message };
  console.error("[mail] action failed:", error);
  return { ok: false, error: "Не удалось выполнить действие" };
}

function done(userId: string): { ok: true } {
  invalidateUnread(userId);
  revalidatePath("/admin/mail", "layout");
  return { ok: true };
}

const uidList = (uids: number[]) => uids.filter((n) => Number.isInteger(n) && n > 0).join(",");

// ---- Counters --------------------------------------------------------------

export type MailUnreadResult =
  | { configured: false }
  | { configured: true; ok: true; counts: UnreadCounts }
  | { configured: true; ok: false };

export async function getMailUnread(): Promise<MailUnreadResult> {
  const session = await getStaffSession("view");
  if (!session) return { configured: false };
  const account = await getMailAccount(session.userId);
  if (!account) return { configured: false };
  try {
    const { counts } = await getFoldersWithCounts(account);
    return { configured: true, ok: true, counts };
  } catch {
    return { configured: true, ok: false };
  }
}

// ---- Message operations ----------------------------------------------------

export async function setMessagesSeen(path: string, uids: number[], seen: boolean): Promise<MailActionResult> {
  // Opening a letter marks it read -- allowed with «Просмотр».
  const r = await requireAccount("view");
  if ("error" in r) return { ok: false, error: r.error };
  const range = uidList(uids);
  if (!range) return { ok: false, error: "Не выбраны письма" };
  try {
    await withFolder(r.account, path, (client) =>
      seen
        ? client.messageFlagsAdd(range, ["\\Seen"], { uid: true })
        : client.messageFlagsRemove(range, ["\\Seen"], { uid: true })
    );
    return done(r.account.userId);
  } catch (error) {
    return fail(error);
  }
}

/** Moves letters to a folder given by its path or by role (Спам, Входящие...). */
export async function moveMessages(
  path: string,
  uids: number[],
  target: { path: string } | { role: Exclude<FolderRole, "custom"> }
): Promise<MailActionResult> {
  const r = await requireAccount();
  if ("error" in r) return { ok: false, error: r.error };
  const range = uidList(uids);
  if (!range) return { ok: false, error: "Не выбраны письма" };
  try {
    const { folders } = await getFoldersWithCounts(r.account);
    const destination =
      "path" in target
        ? folders.find((f) => f.path === target.path)
        : folderByRole(folders, target.role);
    if (!destination) return { ok: false, error: "Папка не найдена" };
    if (destination.path === path) return { ok: true };
    await withFolder(r.account, path, (client) => client.messageMove(range, destination.path, { uid: true }));
    return done(r.account.userId);
  } catch (error) {
    return fail(error);
  }
}

/** To Удалённые; letters already there are deleted for good. */
export async function deleteMessages(path: string, uids: number[]): Promise<MailActionResult> {
  const r = await requireAccount();
  if ("error" in r) return { ok: false, error: r.error };
  const range = uidList(uids);
  if (!range) return { ok: false, error: "Не выбраны письма" };
  try {
    const { folders } = await getFoldersWithCounts(r.account);
    const trash = folderByRole(folders, "trash");
    await withFolder(r.account, path, async (client) => {
      if (trash && trash.path !== path) await client.messageMove(range, trash.path, { uid: true });
      else await client.messageDelete(range, { uid: true });
    });
    return done(r.account.userId);
  } catch (error) {
    return fail(error);
  }
}

// ---- Compose ---------------------------------------------------------------

function readOutgoing(form: FormData): { ok: true; mail: OutgoingMail } | { ok: false; error: string } {
  const to = parseRecipients(String(form.get("to") ?? ""));
  if (!to.ok) return { ok: false, error: `Некорректный адрес: ${to.bad}` };
  const cc = parseRecipients(String(form.get("cc") ?? ""));
  if (!cc.ok) return { ok: false, error: `Некорректный адрес в копии: ${cc.bad}` };

  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.reduce((n, f) => n + f.size, 0) > MAX_ATTACHMENTS_BYTES) {
    return { ok: false, error: "Вложения больше 15 МБ — отправьте их ссылкой или частями" };
  }
  const attachPath = String(form.get("attachFromPath") ?? "");
  const attachUid = Number(form.get("attachFromUid") ?? 0);
  const references = String(form.get("references") ?? "").split(/\s+/).filter(Boolean);

  return {
    ok: true,
    mail: {
      to: to.list,
      cc: cc.list,
      subject: String(form.get("subject") ?? "").trim(),
      // Form submission turns textarea line breaks into CRLF.
      body: String(form.get("body") ?? "").replace(/\r\n/g, "\n"),
      includeLogo: form.get("includeLogo") === "1",
      inReplyTo: String(form.get("inReplyTo") ?? "") || undefined,
      references,
      files,
      attachFrom: attachPath && attachUid > 0 ? { path: attachPath, uid: attachUid } : undefined,
    },
  };
}

export async function sendMail(form: FormData): Promise<MailActionResult> {
  const r = await requireAccount();
  if ("error" in r) return { ok: false, error: r.error };
  const parsed = readOutgoing(form);
  if (!parsed.ok) return parsed;
  if (parsed.mail.to.length === 0) return { ok: false, error: "Укажите получателя" };

  try {
    await sendOutgoing(r.account, parsed.mail);
    const draftUid = Number(form.get("draftUid") ?? 0);
    if (draftUid > 0) await deleteDraft(r.account, draftUid).catch(() => {});
    return done(r.account.userId);
  } catch (error) {
    return fail(error);
  }
}

export async function saveDraft(form: FormData): Promise<{ ok: true; draftUid: number | null; draftsPath: string } | { ok: false; error: string }> {
  const r = await requireAccount();
  if ("error" in r) return { ok: false, error: r.error };
  const parsed = readOutgoing(form);
  if (!parsed.ok) return parsed;
  try {
    const previous = Number(form.get("draftUid") ?? 0);
    const saved = await saveDraftMessage(r.account, parsed.mail, previous > 0 ? previous : undefined);
    done(r.account.userId);
    return { ok: true, draftUid: saved.uid, draftsPath: saved.path };
  } catch (error) {
    return fail(error);
  }
}

// ---- Folders ---------------------------------------------------------------

export async function createFolder(name: string): Promise<MailActionResult> {
  const parsedName = folderNameSchema.safeParse(name);
  if (!parsedName.success) return { ok: false, error: parsedName.error.issues[0].message };
  const r = await requireAccount();
  if ("error" in r) return { ok: false, error: r.error };
  try {
    const { folders } = await getFoldersWithCounts(r.account);
    if (folders.some((f) => f.name.toLowerCase() === parsedName.data.toLowerCase())) {
      return { ok: false, error: "Папка с таким названием уже есть" };
    }
    await withImap(r.account, (client) => client.mailboxCreate(parsedName.data));
    return done(r.account.userId);
  } catch (error) {
    return fail(error);
  }
}

export async function renameFolder(path: string, name: string): Promise<MailActionResult> {
  const parsedName = folderNameSchema.safeParse(name);
  if (!parsedName.success) return { ok: false, error: parsedName.error.issues[0].message };
  const r = await requireAccount();
  if ("error" in r) return { ok: false, error: r.error };
  try {
    const { folders } = await getFoldersWithCounts(r.account);
    const folder = folders.find((f) => f.path === path);
    if (!folder || folder.role !== "custom") return { ok: false, error: "Системные папки переименовать нельзя" };
    await withImap(r.account, (client) => client.mailboxRename(path, parsedName.data));
    return done(r.account.userId);
  } catch (error) {
    return fail(error);
  }
}

export async function deleteFolder(path: string): Promise<MailActionResult> {
  const r = await requireAccount();
  if ("error" in r) return { ok: false, error: r.error };
  try {
    const { folders } = await getFoldersWithCounts(r.account);
    const folder = folders.find((f) => f.path === path);
    if (!folder || folder.role !== "custom") return { ok: false, error: "Системные папки удалить нельзя" };
    await withImap(r.account, (client) => client.mailboxDelete(path));
    return done(r.account.userId);
  } catch (error) {
    return fail(error);
  }
}
