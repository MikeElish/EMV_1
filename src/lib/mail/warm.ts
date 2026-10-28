import "server-only";
import { prisma } from "@/lib/prisma";
import { getMailAccount } from "@/lib/mail/account";
import { folderByRole } from "@/lib/mail/imap";
import { listMessages } from "@/lib/mail/messages";
import { getFoldersWithCounts } from "@/lib/mail/unread";

// Почта opens without waiting on Yandex: every few minutes the folders'
// counters and the first page of Входящие and Отправленные are read for
// everyone with a mailbox, so the letters' lines are already kept
// (MailSummary) and a page asks only the flags and what came since.

const EVERY_MS = 3 * 60 * 1000;
const timer = globalThis as unknown as { __emvMailWarm?: ReturnType<typeof setInterval> };

export async function warmMail() {
  const users = await prisma.user.findMany({ where: { mailLogin: { not: null } }, select: { id: true } });
  for (const { id } of users) {
    try {
      const account = await getMailAccount(id);
      if (!account) continue;
      const { folders } = await getFoldersWithCounts(account, { wait: true });
      for (const role of ["inbox", "sent"] as const) {
        const folder = folderByRole(folders, role);
        if (folder) await listMessages(account, folder.path, 1);
      }
    } catch (error) {
      console.error("[mail-warm]", id, error instanceof Error ? error.message : error);
    }
  }
}

/** Started from src/instrumentation.ts: at once, then every few minutes. */
export function startMailWarmTimer() {
  if (timer.__emvMailWarm) return;
  const run = () => warmMail().catch((error) => console.error("[mail-warm]", error));
  timer.__emvMailWarm = setInterval(run, EVERY_MS);
  setTimeout(run, 10 * 1000);
}
