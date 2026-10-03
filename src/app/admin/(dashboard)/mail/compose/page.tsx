import { verifyStaffSession } from "@/lib/staff-dal";
import { getMailAccount } from "@/lib/mail/account";
import { folderByRole, MailError } from "@/lib/mail/imap";
import { getFoldersWithCounts } from "@/lib/mail/unread";
import { getMessage, type MailAddress, type MessageDetail } from "@/lib/mail/messages";
import { MailErrorBox } from "@/components/mail/MailPages";
import { ComposeForm, type ComposeInitial } from "@/components/mail/ComposeForm";
import { formatFullDate } from "@/components/mail/format";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const formatAddress = (a: MailAddress) => (a.name ? `${a.name} <${a.address}>` : a.address);
const join = (list: MailAddress[]) => list.map(formatAddress).join(", ");

function withPrefix(prefix: string, subject: string) {
  return new RegExp(`^${prefix}:`, "i").test(subject) ? subject : `${prefix}: ${subject}`;
}

function signatureBlock(signature: string) {
  return signature.trim() ? `\n\n-- \n${signature.trim()}` : "";
}

function quote(message: MessageDetail) {
  const author = message.from[0] ? formatAddress(message.from[0]) : "";
  const lines = message.text.replace(/\s+$/, "").split("\n").map((l) => `> ${l}`);
  return `\n\n${formatFullDate(message.date)}, ${author} пишет:\n${lines.join("\n")}`;
}

export default async function ComposePage({ searchParams }: PageProps<"/admin/mail/compose">) {
  const { userId } = await verifyStaffSession();
  const account = await getMailAccount(userId);
  if (!account) return null;

  const params = await searchParams;
  const mode = one(params.mode);
  const draftUid = Number(one(params.draft));
  const signature = signatureBlock(account.signature);

  let initial: ComposeInitial = { to: "", cc: "", subject: "", body: signature };

  try {
    if (draftUid > 0) {
      const drafts = folderByRole((await getFoldersWithCounts(account)).folders, "drafts");
      if (!drafts) return <MailErrorBox message="В ящике нет папки «Черновики»" />;
      const draft = await getMessage(account, drafts.path, draftUid, false);
      initial = {
        to: join(draft.to),
        cc: join(draft.cc),
        subject: draft.subject === "(без темы)" ? "" : draft.subject,
        body: draft.text,
        draftUid,
        inReplyTo: undefined,
        references: draft.references,
        carried: draft.attachments.length
          ? { path: drafts.path, uid: draftUid, names: draft.attachments.map((a) => a.filename) }
          : undefined,
      };
    } else if (mode === "reply" || mode === "replyAll" || mode === "forward") {
      const path = one(params.path);
      const uid = Number(one(params.uid));
      const original = await getMessage(account, path, uid, false);
      const self = account.login.toLowerCase();
      const notSelf = (a: MailAddress) => a.address.toLowerCase() !== self;

      if (mode === "forward") {
        initial = {
          to: "",
          cc: "",
          subject: withPrefix("Fwd", original.subject),
          body:
            signature +
            "\n\n-------- Пересылаемое сообщение --------\n" +
            `От: ${join(original.from)}\nДата: ${formatFullDate(original.date)}\nТема: ${original.subject}\nКому: ${join(original.to)}\n\n` +
            original.text,
          carried: original.attachments.length
            ? { path, uid, names: original.attachments.map((a) => a.filename) }
            : undefined,
        };
      } else {
        const replyTo = original.replyTo.length ? original.replyTo : original.from;
        const to =
          mode === "replyAll"
            ? [...replyTo, ...original.to.filter(notSelf)]
            : replyTo;
        const seen = new Set<string>();
        const unique = (list: MailAddress[]) =>
          list.filter((a) => {
            const key = a.address.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        initial = {
          to: join(unique(to)),
          cc: mode === "replyAll" ? join(unique(original.cc.filter(notSelf))) : "",
          subject: withPrefix("Re", original.subject),
          body: signature + quote(original),
          inReplyTo: original.messageId ?? undefined,
          references: [...original.references, ...(original.messageId ? [original.messageId] : [])],
        };
      }
    }
  } catch (error) {
    return <MailErrorBox message={error instanceof MailError ? error.message : "Не удалось открыть письмо"} />;
  }

  return <ComposeForm initial={initial} from={`${account.senderName} <${account.login}>`} />;
}
