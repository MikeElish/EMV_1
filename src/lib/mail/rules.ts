import "server-only";
import nodemailer from "nodemailer";
import { simpleParser } from "mailparser";
import type { ImapFlow, MessageStructureObject } from "imapflow";
import type { MailRule } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMailAccount, type MailAccount } from "@/lib/mail/account";
import { folderByRole, listFolders, withFolder } from "@/lib/mail/imap";
import { invalidateUnread } from "@/lib/mail/unread";
import type { MailRuleCondition } from "@/lib/validators/mail-rules";

// «Правила обработки писем». Yandex runs its own filters at delivery; ours
// work over IMAP: new letters in Входящие are picked up every minute (and
// whenever the employee opens Входящие) and the matching rules applied.

const INBOX = "INBOX";
const MAX_PER_RUN = 200;
const MAX_BODY_BYTES = 5 * 1024 * 1024;
const REPLY_EVERY_MS = 24 * 60 * 60 * 1000;

type Letter = {
  uid: number;
  from: string[];
  to: string[];
  cc: string[];
  replyTo: string | null;
  fromAddress: string | null;
  subject: string;
  messageId: string | null;
  attachmentNames: string[];
  automated: boolean;
  size: number;
  body?: string;
};

type Plan = { markRead: boolean; flag: boolean; moveTo: string | null; remove: boolean; forwards: Set<string>; reply: string | null };

const lower = (s: string) => s.toLowerCase().trim();

function addressTexts(list: { name?: string; address?: string }[] | undefined) {
  return (list ?? []).flatMap((a) => [a.address ?? "", a.name ?? "", a.name ? `${a.name} <${a.address}>` : ""]).filter(Boolean);
}

function attachmentNamesOf(node: MessageStructureObject | undefined, out: string[] = []) {
  if (!node) return out;
  const name = node.dispositionParameters?.filename ?? node.parameters?.name;
  if (name && (node.disposition === "attachment" || !node.type.startsWith("text/"))) out.push(name);
  for (const child of node.childNodes ?? []) attachmentNamesOf(child, out);
  return out;
}

function valuesFor(letter: Letter, field: MailRuleCondition["field"]): string[] {
  switch (field) {
    case "from":
      return letter.from;
    case "to":
      return letter.to;
    case "toOrCc":
      return [...letter.to, ...letter.cc];
    case "subject":
      return [letter.subject];
    case "body":
      return [letter.body ?? ""];
    case "attachmentName":
      return letter.attachmentNames;
  }
}

function conditionMatches(letter: Letter, c: MailRuleCondition) {
  const values = valuesFor(letter, c.field).map(lower);
  const v = lower(c.value);
  switch (c.op) {
    case "contains":
      return values.some((x) => x.includes(v));
    case "notContains":
      return !values.some((x) => x.includes(v));
    case "equals":
      return values.some((x) => x === v);
    case "notEquals":
      return !values.some((x) => x === v);
  }
}

export function ruleMatches(rule: MailRule, letter: Letter) {
  if (rule.attachments === "with" && !letter.attachmentNames.length) return false;
  if (rule.attachments === "without" && letter.attachmentNames.length) return false;
  const conditions = rule.conditions as MailRuleCondition[];
  return rule.matchAll ? conditions.every((c) => conditionMatches(letter, c)) : conditions.some((c) => conditionMatches(letter, c));
}

const needsBody = (rules: MailRule[]) =>
  rules.some((r) => (r.conditions as MailRuleCondition[]).some((c) => c.field === "body"));

/** Envelope-level data of the letters with these UIDs (plus the body when a rule looks at it). */
async function readLetters(
  client: ImapFlow,
  range: string,
  withBody: boolean,
  { byUid }: { byUid: boolean } = { byUid: true }
): Promise<Letter[]> {
  const letters: Letter[] = [];
  for await (const msg of client.fetch(
    range,
    { uid: true, envelope: true, bodyStructure: true, size: true, headers: ["auto-submitted", "precedence", "list-id"] },
    { uid: byUid }
  )) {
    const env = msg.envelope;
    const headers = msg.headers?.toString("utf8").toLowerCase() ?? "";
    const autoSubmitted = /auto-submitted:\s*(?!no)\S/.test(headers);
    const bulk = /precedence:\s*(bulk|junk|list)/.test(headers) || headers.includes("list-id:");
    letters.push({
      uid: msg.uid,
      from: addressTexts(env?.from),
      to: addressTexts(env?.to),
      cc: addressTexts(env?.cc),
      fromAddress: env?.from?.[0]?.address ?? null,
      replyTo: env?.replyTo?.[0]?.address ?? null,
      subject: env?.subject ?? "",
      messageId: env?.messageId ?? null,
      attachmentNames: attachmentNamesOf(msg.bodyStructure),
      automated: autoSubmitted || bulk,
      size: msg.size ?? 0,
    });
  }
  if (withBody) {
    for (const letter of letters) {
      if (letter.size > MAX_BODY_BYTES) continue;
      const one = await client.fetchOne(String(letter.uid), { source: true }, { uid: true });
      if (one && one.source) letter.body = (await simpleParser(one.source)).text ?? "";
    }
  }
  return letters;
}

function planFor(rules: MailRule[], letter: Letter, { allActions }: { allActions: boolean }): Plan | null {
  const plan: Plan = { markRead: false, flag: false, moveTo: null, remove: false, forwards: new Set(), reply: null };
  let matched = false;
  for (const rule of rules) {
    if (!ruleMatches(rule, letter)) continue;
    matched = true;
    plan.markRead ||= rule.markRead;
    plan.flag ||= rule.flag;
    plan.remove ||= rule.remove;
    plan.moveTo ??= rule.moveTo;
    if (allActions) {
      if (rule.forwardTo) plan.forwards.add(rule.forwardTo);
      plan.reply ??= rule.replyText || null;
    }
    if (rule.stopProcessing) break;
  }
  return matched ? plan : null;
}

function transportFor(account: MailAccount) {
  return nodemailer.createTransport({
    host: account.smtpHost,
    port: account.smtpPort,
    secure: account.smtpPort === 465,
    auth: { user: account.login, pass: account.password },
  });
}

async function forwardLetter(account: MailAccount, to: string, letter: Letter, raw: Buffer) {
  await transportFor(account).sendMail({
    from: { name: account.senderName || account.login, address: account.login },
    to,
    subject: `Fwd: ${letter.subject}`,
    text: "Пересланное письмо — во вложении.",
    attachments: [{ filename: "message.eml", content: raw, contentType: "message/rfc822" }],
    headers: { "Auto-Submitted": "auto-forwarded" },
  });
}

async function replyToLetter(account: MailAccount, to: string, letter: Letter, text: string) {
  await transportFor(account).sendMail({
    from: { name: account.senderName || account.login, address: account.login },
    to,
    subject: /^re:/i.test(letter.subject) ? letter.subject : `Re: ${letter.subject}`,
    text,
    ...(letter.messageId ? { inReplyTo: letter.messageId, references: letter.messageId } : {}),
    headers: { "Auto-Submitted": "auto-replied" },
  });
}

type Replied = Record<string, string>;

/** Carries out the plans; returns the updated auto-reply log. */
async function execute(
  client: ImapFlow,
  account: MailAccount,
  work: { letter: Letter; plan: Plan }[],
  replied: Replied
): Promise<Replied> {
  const folders = work.some((w) => w.plan.remove) ? await listFolders(account) : [];
  const trash = folderByRole(folders, "trash");
  const now = Date.now();
  const log: Replied = Object.fromEntries(
    Object.entries(replied).filter(([, at]) => now - new Date(at).getTime() < REPLY_EVERY_MS)
  );

  for (const { letter, plan } of work) {
    const uid = String(letter.uid);
    try {
      const flags = [plan.markRead && "\\Seen", plan.flag && "\\Flagged"].filter(Boolean) as string[];
      if (flags.length) await client.messageFlagsAdd(uid, flags, { uid: true });

      const replyTo = (letter.replyTo ?? letter.fromAddress ?? "").toLowerCase();
      const canReply =
        !!plan.reply &&
        !!replyTo &&
        !letter.automated &&
        replyTo !== account.login.toLowerCase() &&
        !/(no-?reply|mailer-daemon|postmaster)@/i.test(replyTo) &&
        !log[replyTo];
      if (plan.forwards.size || canReply) {
        const one = await client.fetchOne(uid, { source: true }, { uid: true });
        const raw = one ? one.source : undefined;
        for (const to of plan.forwards) if (raw) await forwardLetter(account, to, letter, raw);
        if (canReply) {
          await replyToLetter(account, replyTo, letter, plan.reply!);
          log[replyTo] = new Date().toISOString();
        }
      }

      if (plan.remove) {
        if (trash) await client.messageMove(uid, trash.path, { uid: true });
        else await client.messageDelete(uid, { uid: true });
      } else if (plan.moveTo && plan.moveTo !== INBOX) {
        await client.messageMove(uid, plan.moveTo, { uid: true });
      }
    } catch (error) {
      console.error("[mail-rules] letter", letter.uid, "of", account.userId, error);
    }
  }
  return log;
}

const running = globalThis as unknown as { __emvMailRules?: Map<string, Promise<number>> };
const inFlight: Map<string, Promise<number>> = (running.__emvMailRules ??= new Map());

/** Applies the user's enabled rules to letters that arrived in Входящие since the last run. */
export function processMailRules(userId: string): Promise<number> {
  const current = inFlight.get(userId);
  if (current) return current;
  const job = run(userId).finally(() => inFlight.delete(userId));
  inFlight.set(userId, job);
  return job;
}

async function run(userId: string): Promise<number> {
  const [rules, account, state] = await Promise.all([
    prisma.mailRule.findMany({ where: { userId, enabled: true }, orderBy: { position: "asc" } }),
    getMailAccount(userId),
    prisma.mailRuleState.findUnique({ where: { userId } }),
  ]);
  if (!rules.length || !account) return 0;

  const result = await withFolder(account, INBOX, async (client) => {
    const box = client.mailbox;
    if (!box) return null;
    const validity = String(box.uidValidity);
    // First run (or the mailbox was rebuilt): start from letters arriving now.
    // Asked from the server: the pooled connection's own copy of the
    // mailbox state can be stale.
    if (!state || state.uidValidity !== validity) {
      const status = await client.status(INBOX, { uidNext: true });
      return { validity, lastUid: ((status && status.uidNext) || 1) - 1, replied: {}, count: 0 };
    }

    const found = await client.search({ uid: `${state.lastUid + 1}:*` }, { uid: true });
    // "N:*" also matches the newest letter when there is nothing above N.
    const uids = (Array.isArray(found) ? found : [])
      .filter((uid) => uid > state.lastUid)
      .sort((a, b) => a - b)
      .slice(0, MAX_PER_RUN);
    if (!uids.length) return { validity, lastUid: state.lastUid, replied: state.replied as Replied, count: 0 };

    const to = uids[uids.length - 1];
    const letters = await readLetters(client, uids.join(","), needsBody(rules));
    const work = letters.flatMap((letter) => {
      const plan = planFor(rules, letter, { allActions: true });
      return plan ? [{ letter, plan }] : [];
    });
    const replied = await execute(client, account, work, state.replied as Replied);
    return { validity, lastUid: to, replied, count: work.length };
  });
  if (!result) return 0;

  await prisma.mailRuleState.upsert({
    where: { userId },
    create: { userId, uidValidity: result.validity, lastUid: result.lastUid, replied: result.replied },
    update: { uidValidity: result.validity, lastUid: result.lastUid, replied: result.replied },
  });
  if (result.count) invalidateUnread(userId);
  return result.count;
}

/**
 * «Применить к письмам во Входящих» when saving a rule: the newest letters
 * already there get its folder / read / flag / delete actions (never a
 * forward or an auto-reply, as in Yandex).
 */
export async function applyRuleToInbox(userId: string, ruleId: string, limit = 1000): Promise<number> {
  const [rule, account] = await Promise.all([
    prisma.mailRule.findUnique({ where: { id: ruleId } }),
    getMailAccount(userId),
  ]);
  if (!rule || rule.userId !== userId || !account) return 0;
  const count = await withFolder(account, INBOX, async (client) => {
    const box = client.mailbox;
    if (!box || !box.exists) return 0;
    const first = Math.max(1, box.exists - limit + 1);
    // The newest `limit` letters, by sequence number.
    const letters = await readLetters(client, `${first}:*`, needsBody([rule]), { byUid: false });
    const work = letters.flatMap((letter) => {
      const plan = planFor([rule], letter, { allActions: false });
      return plan ? [{ letter, plan }] : [];
    });
    await execute(client, account, work, {});
    return work.length;
  });
  if (count) invalidateUnread(userId);
  return count;
}

const timer = globalThis as unknown as { __emvMailRulesTimer?: ReturnType<typeof setInterval> };

/** Every minute: everyone with enabled rules and a connected mailbox. Started from src/instrumentation.ts. */
export function startMailRulesTimer() {
  if (timer.__emvMailRulesTimer) return;
  timer.__emvMailRulesTimer = setInterval(async () => {
    const users = await prisma.user
      .findMany({
        where: { mailLogin: { not: null }, mailRules: { some: { enabled: true } } },
        select: { id: true },
      })
      .catch(() => []);
    for (const { id } of users) {
      try {
        await processMailRules(id);
      } catch (error) {
        console.error("[mail-rules] run failed for", id, error);
      }
    }
  }, 60 * 1000);
}
