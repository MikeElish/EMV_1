import "server-only";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import sanitizeHtml from "sanitize-html";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { sendSiteMail } from "@/lib/mailer";
import { decryptSecret } from "@/lib/secret-box";
import { analyzeOfferRows, sheetRows, unpricedOfferProductIds, writeOfferRows } from "@/lib/offer-import";
import {
  analyzePriceReplyText,
  findFreeDeliveryTerm,
  noOfferPriceProductIds,
  requestedPriceProductIds,
} from "@/lib/price-reply-text";

// Supplier quote requests use a tokenized web form and are sent only after
// an administrator confirms them. This timer only reads supplier replies and
// updates internal price-check summaries.

/** The shop's mailbox: a copy of every request and the summaries. */
export const SHOP_MAILBOX = "emv@emv.one";
const DAY = 24 * 60 * 60 * 1000;
const NO_OFFER_AFTER = 2 * DAY;
const TIMER_MS = 30 * 60 * 1000;

/** Outside a request (the timer) Next has nothing to revalidate. */
function refresh(...paths: string[]) {
  for (const p of paths) {
    try {
      revalidatePath(p);
    } catch {
      // not in a request
    }
  }
}


/**
 * Requests quotes only from suppliers with a recorded offer on a checking
 * product in this order. The bearer link is stored as a hash and is disabled
 * as soon as none of its requested order lines remains in «Проверка заказа».
 */
// ---- Replies ------------------------------------------------------------------

export type Mailbox = { host: string; port: number; user: string; pass: string };

/** The site's mailbox (Настройки → Почта) and the shop's (the owner's in Почта). */
export async function mailboxes(): Promise<Mailbox[]> {
  const [site, owner] = await Promise.all([
    prisma.mailSettings.findUnique({ where: { id: 1 } }),
    prisma.user.findFirst({ where: { mailLogin: SHOP_MAILBOX, mailPasswordEnc: { not: null } }, select: { mailLogin: true, mailPasswordEnc: true } }),
  ]);
  const host = site?.imapHost ?? "imap.yandex.ru";
  const port = site?.imapPort ?? 993;
  const list: Mailbox[] = [];
  if (site) list.push({ host, port, user: site.login, pass: decryptSecret(site.passwordEnc) });
  if (owner && owner.mailLogin !== site?.login) list.push({ host, port, user: owner.mailLogin!, pass: decryptSecret(owner.mailPasswordEnc!) });
  return list;
}

type Part = { part?: string; type?: string; disposition?: string; dispositionParameters?: { filename?: string }; parameters?: { name?: string }; childNodes?: Part[] };
const tables = (p: Part | undefined): { part: string; name: string }[] => {
  if (!p) return [];
  const name = p.dispositionParameters?.filename ?? p.parameters?.name ?? "";
  const own = p.part && /\.(xlsx|xls|ods|csv)$/i.test(name) ? [{ part: p.part, name }] : [];
  return [...own, ...(p.childNodes ?? []).flatMap(tables)];
};

const FREE_MAIL = /@(mail|bk|inbox|list|yandex|ya|gmail|rambler|outlook|hotmail|icloud)\./i;

/** Reads new replies: their table becomes offers of that supplier. */
export async function readPriceReplies(): Promise<number> {
  const open = await prisma.priceRequest.findMany({
    where: { answeredAt: null },
    include: { order: { select: { orderNumber: true } } },
    orderBy: { sentAt: "asc" },
  });
  if (!open.length) return 0;
  const since = new Date(open[0].sentAt.getTime() - DAY);
  let answered = 0;

  for (const box of await mailboxes()) {
    const client = new ImapFlow({ host: box.host, port: box.port, secure: box.port === 993, auth: { user: box.user, pass: box.pass }, logger: false });
    try {
      await client.connect();
      const lock = await client.getMailboxLock("INBOX");
      try {
        const uids = (await client.search({ since }, { uid: true })) || [];
        if (!uids.length) continue;
        const letters = [];
        for await (const m of client.fetch(uids, { envelope: true, bodyStructure: true }, { uid: true })) letters.push(m);
        for (const m of letters) {
          const from = m.envelope?.from?.[0]?.address?.toLowerCase() ?? "";
          if (!from || from === box.user.toLowerCase()) continue;
          const domain = from.split("@")[1];
          const waiting = open.filter((r) => !r.answeredAt && (r.email === from || (!FREE_MAIL.test(r.email) && r.email.endsWith(`@${domain}`))));
          if (!waiting.length) continue;
          const subject = m.envelope?.subject ?? "";
          const request =
            waiting.find((r) => r.messageId && m.envelope?.inReplyTo?.includes(r.messageId)) ??
            waiting.find((r) => subject.includes(r.order.orderNumber)) ??
            (waiting.length === 1 ? waiting[0] : null);
          if (!request || (m.envelope?.date && m.envelope.date < request.sentAt)) continue;

          let note = "Ответ без таблицы — посмотрите письмо";
          let answerBody: string | null = null;
          let importedAttachment = false;
          let replyText = "";
          const source = await client.fetchOne(String(m.uid), { source: true }, { uid: true });
          const rawSource = source && source.source;
          if (typeof rawSource === "string" || Buffer.isBuffer(rawSource)) {
            const parsed = await simpleParser(rawSource);
            replyText = (
              parsed.text ||
              sanitizeHtml(parsed.html || "", { allowedTags: [], allowedAttributes: {} })
            )
              .trim()
              .slice(0, 20_000);
          }
          const productIds = requestedPriceProductIds(request.items);
          const products = await prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, sku: true, name: true, brand: true },
          });
          let offeredProductIds: string[] = [];
          let attachmentNoOfferIds: string[] = [];
          for (const t of tables(m.bodyStructure as Part)) {
            const download = await client.download(String(m.uid), t.part, { uid: true });
            if (!download?.content) continue;
            const chunks: Buffer[] = [];
            for await (const c of download.content) chunks.push(c as Buffer);
            const content = Buffer.concat(chunks);
            if (!content.length) continue;
            try {
              const rows = sheetRows(content, t.name);
              const analysis = await analyzeOfferRows(rows, request.supplierId, true);
              const unpricedIds = unpricedOfferProductIds(rows, products);
              if (!analysis.rows.length && !unpricedIds.length) continue;
              const written = analysis.rows.length
                ? await writeOfferRows(request.supplierId, analysis.rows, false)
                : { added: 0, updated: 0, skipped: 0, created: 0 };
              offeredProductIds = analysis.rows
                .flatMap((row) => (row.productId && row.price > 0 ? [row.productId] : []));
              attachmentNoOfferIds = unpricedIds;
              const priced = written.added + written.updated;
              const analogs = analysis.rows.filter((r) => r.analog).map((r) => `${r.sku} → ${r.analog}`);
              note = [
                `Цен получено: ${priced}`,
                written.skipped && `нет в каталоге: ${analysis.rows.filter((r) => !r.productId).map((r) => r.sku).join(", ")}`,
                unpricedIds.length && `нет предложения по артикулам: ${products.filter((p) => unpricedIds.includes(p.id)).map((p) => p.sku).join(", ")}`,
                analogs.length && `аналоги: ${analogs.join("; ")}`,
              ]
                .filter(Boolean)
                .join("; ");
              importedAttachment = true;
              break;
            } catch (error) {
              console.error("[price-requests] could not analyze reply attachment", t.name, error);
            }
          }
          if (offeredProductIds.length) {
            await prisma.priceRequestLine.updateMany({
              where: { requestId: request.id, productId: { in: offeredProductIds } },
              data: { status: "OFFER" },
            });
          }
          const refusedIds = [...new Set([...attachmentNoOfferIds, ...noOfferPriceProductIds(replyText, products)])]
            .filter((productId) => !offeredProductIds.includes(productId));
          if (refusedIds.length) {
            await prisma.priceRequestLine.updateMany({
              where: { requestId: request.id, productId: { in: refusedIds }, status: { not: "OFFER" } },
              data: { status: "NO_OFFER" },
            });
          }
          if (!importedAttachment && replyText) {
            answerBody = replyText;
            const candidates = analyzePriceReplyText(answerBody, products);
            const deliveryTerm = findFreeDeliveryTerm(answerBody);
            note = [
              "Ответ в теле письма — требуется проверка",
              candidates.length ? `найдены цены по артикулам: ${candidates.map((c) => c.sku).join(", ")}` : null,
              refusedIds.length ? `нет предложения по артикулам: ${products.filter((p) => refusedIds.includes(p.id)).map((p) => p.sku).join(", ")}` : null,
              deliveryTerm,
            ]
              .filter(Boolean)
              .join("; ");
          }
          await prisma.priceRequest.update({
            where: { id: request.id },
            data: {
              answeredAt: new Date(),
              answerNote: note.slice(0, 1000),
              answerBody,
              answerReviewedAt: null,
            },
          });
          request.answeredAt = new Date();
          answered++;
        }
      } finally {
        lock.release();
      }
    } catch (error) {
      console.error("[price-requests] mailbox", box.user, error);
    } finally {
      await client.logout().catch(() => {});
    }
  }
  if (answered) refresh("/admin/crm/price-check", "/admin/crm/products");
  return answered;
}

// ---- Reminders and the summary -------------------------------------------------

/** Marks unanswered request lines as «Нет предложения» after the reminder window expires. */
export async function markUnansweredPriceRequestsAsNoOffer(): Promise<number> {
  const cutoff = new Date(Date.now() - NO_OFFER_AFTER);
  const requests = await prisma.priceRequest.findMany({
    where: { answeredAt: null, sentAt: { lt: cutoff } },
    select: { id: true },
  });
  if (!requests.length) return 0;

  const requestIds = requests.map((request) => request.id);
  const updated = await prisma.priceRequestLine.updateMany({
    where: { requestId: { in: requestIds }, status: "PENDING" },
    data: { status: "NO_OFFER" },
  });
  await prisma.priceRequest.updateMany({
    where: { id: { in: requestIds }, answeredAt: null },
    data: { answerNote: "Ответ не получен за 48 часов; оставшиеся позиции отмечены «Нет предложения»" },
  });
  if (updated.count) refresh("/admin/crm/price-check");
  return updated.count;
}

/** Two days after the requests of an order: «Проценка завершена» with who answered. */
export async function sendPriceSummaries(): Promise<number> {
  const due = await prisma.priceRequest.findMany({
    where: { summarySentAt: null, sentAt: { lt: new Date(Date.now() - 2 * DAY) } },
    select: { orderId: true },
    distinct: ["orderId"],
  });
  for (const { orderId } of due) {
    const requests = await prisma.priceRequest.findMany({
      where: { orderId },
      include: { supplier: { select: { name: true } }, order: { select: { orderNumber: true } } },
      orderBy: { sentAt: "asc" },
    });
    const requestLines = await prisma.priceRequestLine.findMany({
      where: { requestId: { in: requests.map((request) => request.id) } },
      include: { product: { select: { sku: true } } },
    });
    const lines = requests.map((r) => {
      const noOffer = requestLines
        .filter((line) => line.requestId === r.id && line.status === "NO_OFFER")
        .map((line) => line.product.sku);
      return `${r.supplier.name} — ${r.email} — ${r.answeredAt ? "КП получено" : "КП не получено"}${noOffer.length ? `; нет предложения: ${noOffer.join(", ")}` : ""}${r.answerNote ? ` (${r.answerNote})` : ""}`;
    });
    await sendSiteMail({
      to: SHOP_MAILBOX,
      subject: `Проценка завершена — заказ ${requests[0].order.orderNumber}`,
      text: `Проценка завершена\n\n${lines.join("\n")}`,
    });
    await prisma.priceRequest.updateMany({ where: { orderId, summarySentAt: null }, data: { summarySentAt: new Date() } });
  }
  return due.length;
}

const timerState = globalThis as unknown as { __emvPriceRequestTimer?: NodeJS.Timeout };

/** Every half hour: process replies and report completed requests. Quote requests are sent manually. */
export function startPriceRequestTimer() {
  if (timerState.__emvPriceRequestTimer) return;
  timerState.__emvPriceRequestTimer = setInterval(async () => {
    for (const [name, step] of [
      ["replies", readPriceReplies],
      ["no-offer", markUnansweredPriceRequestsAsNoOffer],
      ["summaries", sendPriceSummaries],
    ] as const) {
      try {
        await step();
      } catch (error) {
        console.error(`[price-requests] ${name}`, error);
      }
    }
  }, TIMER_MS);
}
