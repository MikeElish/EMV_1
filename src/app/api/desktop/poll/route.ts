import { prisma } from "@/lib/prisma";
import { getMyAccess, hasAccess } from "@/lib/access-server";
import { getSuppliers } from "@/lib/price-settings";
import { getMailAccount } from "@/lib/mail/account";
import { withFolder } from "@/lib/mail/imap";
import { getFoldersWithCounts, isWatchedFolder } from "@/lib/mail/unread";
import { formatRub } from "@/lib/money";

// Polled once a minute by the Windows program (desktop/): what is new since
// its last call, for notifications. The cursors come back in the answer --
// the first call (no cursors) only returns them, so nothing old pops up.
//   ?ordersSince=<ISO time of the server>&mail=<JSON cursor from the previous answer>

const MAX_ITEMS = 5;

/** Mail cursor: folder path → "<uidValidity>:<uid of its newest letter>". Opaque to the program. */
type MailCursor = Record<string, string>;

type MailPart = {
  /** Unread in Входящие + Мои папки, as next to «Почта». */
  unread: number;
  cursor: MailCursor;
  letters: { folder: string; from: string; subject: string; url: string }[];
};

function parseCursor(raw: string | null): MailCursor | null {
  if (!raw || raw.length > 20000) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return Object.fromEntries(Object.entries(value).filter(([, v]) => typeof v === "string")) as MailCursor;
  } catch {
    return null;
  }
}

/**
 * New unread letters in Входящие and Мои папки (Yandex filters often file
 * mail straight into a folder). Folder states come from STATUS -- fresh from
 * the server -- so only folders that really grew are opened.
 */
async function pollMail(userId: string, since: MailCursor | null): Promise<MailPart | null> {
  const account = await getMailAccount(userId);
  if (!account) return null;
  const { folders, counts } = await getFoldersWithCounts(account, { wait: true });
  const cursor: MailCursor = {};
  const found: (MailPart["letters"][number] & { date: number })[] = [];

  for (const f of folders.filter(isWatchedFolder)) {
    cursor[f.path] = `${f.uidValidity}:${f.lastUid}`;
    // First call, a new folder or a renumbered one: only remember where it ends.
    const [validity, uid] = (since?.[f.path] ?? "").split(":");
    const from = Number(uid);
    if (!since || validity !== f.uidValidity || !Number.isInteger(from) || f.lastUid <= from) continue;

    await withFolder(account, f.path, async (client) => {
      await client.noop(); // the pooled connection's view of the folder may be stale
      const first = Math.max(from + 1, f.lastUid - 50); // a flood: only the newest matter
      for await (const msg of client.fetch(`${first}:${f.lastUid}`, { uid: true, flags: true, envelope: true, internalDate: true }, { uid: true })) {
        if (msg.uid <= from || msg.flags?.has("\\Seen")) continue; // already read elsewhere
        const sender = msg.envelope?.from?.[0];
        found.push({
          folder: f.name,
          from: sender?.name || sender?.address || "",
          subject: msg.envelope?.subject || "(без темы)",
          url:
            f.role === "inbox"
              ? `/admin/mail/inbox/${msg.uid}`
              : `/admin/mail/folders/${msg.uid}?path=${encodeURIComponent(f.path)}`,
          date: new Date((msg.internalDate ?? 0) as Date | string).getTime() || 0,
        });
      }
    });
  }

  found.sort((a, b) => a.date - b.date);
  return {
    unread: counts.total,
    cursor,
    letters: found.slice(-MAX_ITEMS).map((l) => ({ folder: l.folder, from: l.from, subject: l.subject, url: l.url })),
  };
}

export async function GET(request: Request) {
  const me = await getMyAccess();
  if (!me) return Response.json({ signedIn: false }, { headers: { "Cache-Control": "no-store" } });

  const params = new URL(request.url).searchParams;
  const now = new Date();
  const sinceRaw = params.get("ordersSince");
  const since = sinceRaw && !Number.isNaN(Date.parse(sinceRaw)) ? new Date(sinceRaw) : null;

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
      mail = await pollMail(me.userId, parseCursor(params.get("mail")));
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
