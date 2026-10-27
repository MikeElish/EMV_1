import { prisma } from "@/lib/prisma";
import { getMyAccess, hasAccess } from "@/lib/access-server";
import { getSuppliers } from "@/lib/price-settings";
import { getMailAccount } from "@/lib/mail/account";
import { withFolder, folderByRole } from "@/lib/mail/imap";
import { getFoldersWithCounts } from "@/lib/mail/unread";
import { formatRub } from "@/lib/money";

// Polled once a minute by the Windows program (desktop/): what is new since
// its last call, for notifications. The cursors come back in the answer --
// the first call (no cursors) only returns them, so nothing old pops up.
//   ?ordersSince=<ISO time of the server>  &mailUid=<last inbox uid>&mailValidity=<uidValidity>

const MAX_ITEMS = 5;

type MailPart = {
  unread: number;
  uid: number;
  validity: string;
  letters: { uid: number; from: string; subject: string }[];
};

async function pollMail(userId: string, sinceUid: number | null, sinceValidity: string | null): Promise<MailPart | null> {
  const account = await getMailAccount(userId);
  if (!account) return null;
  const { folders, counts } = await getFoldersWithCounts(account);
  const inbox = folderByRole(folders, "inbox");
  if (!inbox) return null;
  return withFolder(account, inbox.path, async (client) => {
    const validity = client.mailbox ? String(client.mailbox.uidValidity) : "";
    const letters: MailPart["letters"] = [];
    // First call, or a changed uidValidity (the folder was renumbered): only
    // remember where the inbox ends, without notifying.
    if (sinceUid === null || sinceValidity !== validity) {
      const last = client.mailbox && client.mailbox.exists > 0 ? await client.fetchOne("*", { uid: true }) : null;
      return { unread: counts.inbox, uid: last ? last.uid : 0, validity, letters };
    }
    // `n:*` always matches the last letter, even below n -- hence the filter.
    const fresh = ((await client.search({ uid: `${sinceUid + 1}:*` }, { uid: true })) || []).filter((u) => u > sinceUid);
    if (fresh.length) {
      const uids = fresh.slice(-MAX_ITEMS).join(",");
      for await (const msg of client.fetch(uids, { uid: true, flags: true, envelope: true }, { uid: true })) {
        if (msg.flags?.has("\\Seen")) continue; // already read elsewhere
        const from = msg.envelope?.from?.[0];
        letters.push({ uid: msg.uid, from: from?.name || from?.address || "", subject: msg.envelope?.subject || "(без темы)" });
      }
      letters.sort((a, b) => a.uid - b.uid);
    }
    return { unread: counts.inbox, uid: Math.max(sinceUid, ...fresh), validity, letters };
  });
}

export async function GET(request: Request) {
  const me = await getMyAccess();
  if (!me) return Response.json({ signedIn: false }, { headers: { "Cache-Control": "no-store" } });

  const params = new URL(request.url).searchParams;
  const now = new Date();
  const sinceRaw = params.get("ordersSince");
  const since = sinceRaw && !Number.isNaN(Date.parse(sinceRaw)) ? new Date(sinceRaw) : null;
  const mailUidRaw = params.get("mailUid");
  const mailUid = mailUidRaw && /^\d+$/.test(mailUidRaw) ? Number(mailUidRaw) : null;

  const [canOrders, canMail, canPrices] = await Promise.all([
    hasAccess("crm.orders", "view"),
    hasAccess("mail", "view"),
    hasAccess("crm.price-check", "edit"),
  ]);

  const orders =
    canOrders && since
      ? await prisma.order.findMany({
          where: { createdAt: { gt: since, lte: now } },
          select: { orderNumber: true, customerName: true, totalAmount: true },
          orderBy: { createdAt: "asc" },
          take: MAX_ITEMS,
        })
      : [];

  let mail: MailPart | null = null;
  if (canMail) {
    try {
      mail = await pollMail(me.userId, mailUid, params.get("mailValidity"));
    } catch {
      // mailbox unreachable for now -- the next poll tries again
    }
  }

  return Response.json(
    {
      signedIn: true,
      ordersSince: canOrders ? now.toISOString() : null,
      orders: orders.map((o) => ({
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        total: formatRub(o.totalAmount),
      })),
      mail,
      // Names for the price-list subfolders (Прайсы\<Поставщик>\).
      suppliers: canPrices ? (await getSuppliers()).map((s) => s.name) : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
