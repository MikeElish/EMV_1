import "server-only";
import ExcelJS from "exceljs";
import { ImapFlow } from "imapflow";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { sendSiteMail } from "@/lib/mailer";
import { decryptSecret } from "@/lib/secret-box";
import { analyzeOfferRows, sheetRows, writeOfferRows } from "@/lib/offer-import";

// Проценка по почте. Lines of an order that aren't in stock (Проверка
// заказа) go to the suppliers known for those products -- to the contact of
// the supplier's card, in an Excel sheet sorted by brand, the order number as
// the subject, a copy to the shop's mailbox. Replies in either mailbox (the
// site's and the shop's) are read, and their table becomes the supplier's
// offers. No reply in a day -- a reminder; after two days -- the summary.

/** The shop's mailbox: a copy of every request and the summaries. */
export const SHOP_MAILBOX = "emv@emv.one";
const DAY = 24 * 60 * 60 * 1000;
const TIMER_MS = 30 * 60 * 1000;

type Item = { productId: string; quantity: number };

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

const GREETING = (name: string | null) => (name ? `Добрый день, ${name}!` : "Добрый день!");
const ASK = "Просим предоставить коммерческое предложение по запросу во вложении – заполните таблицу и направьте ответным письмом.";
const ASK_AGAIN = "Повторно просим предоставить коммерческое предложение по запросу во вложении – заполните таблицу и направьте ответным письмом.";

/**
 * The request sheet: Бренд, Наименование, Артикул, Количество, Цена, Итого,
 * Срок поставки, Качество (a list: Original / OEM / Analog), Артикул аналога --
 * the supplier fills the last five. Sorted by brand.
 */
export async function requestSheet(items: Item[]): Promise<Buffer> {
  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) } },
    select: { id: true, sku: true, name: true, brand: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const rows = items
    .map((i) => ({ ...byId.get(i.productId)!, quantity: i.quantity }))
    .filter((r) => r.sku)
    .sort((a, b) => (a.brand ?? "яяя").localeCompare(b.brand ?? "яяя", "ru") || a.name.localeCompare(b.name, "ru"));

  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Запрос");
  sheet.columns = [
    { header: "Бренд", width: 16 },
    { header: "Наименование", width: 42 },
    { header: "Артикул", width: 18 },
    { header: "Количество", width: 12 },
    { header: "Цена", width: 12 },
    { header: "Итого", width: 14 },
    { header: "Срок поставки", width: 15 },
    { header: "Качество", width: 12 },
    { header: "Артикул аналога", width: 18 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  rows.forEach((r, i) => {
    const n = i + 2;
    sheet.addRow([r.brand ?? "", r.name, r.sku, r.quantity, null, { formula: `IF(E${n}="","",D${n}*E${n})` }, null, null, null]);
    sheet.getCell(`H${n}`).dataValidation = { type: "list", allowBlank: true, formulae: ['"Original,OEM,Analog"'] };
  });
  return Buffer.from(await book.xlsx.writeBuffer());
}

const sheetName = (orderNumber: string) => `Запрос ${orderNumber.replace(/\//g, "-")}.xlsx`;

export type RequestsSent = { sent: string[]; noContact: string[]; noSupplier: string[]; already: string[] };

/**
 * Asks the suppliers of the order's lines in «Проверка заказа» (each supplier
 * once per order). Suppliers without a contact e-mail and products without
 * a known supplier are listed back.
 */
export async function sendPriceRequests(orderId: string): Promise<RequestsSent> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { where: { cancelled: false, status: "CHECKING" }, include: { product: { select: { sku: true } } } },
      priceRequests: { select: { supplierId: true } },
    },
  });
  const result: RequestsSent = { sent: [], noContact: [], noSupplier: [], already: [] };
  if (!order || !order.items.length) return result;

  const productIds = [...new Set(order.items.map((i) => i.productId))];
  const [offers, pricing] = await Promise.all([
    prisma.supplierOffer.findMany({ where: { productId: { in: productIds }, supplierId: { not: null } }, select: { productId: true, supplierId: true } }),
    prisma.productPricing.findMany({ where: { productId: { in: productIds }, supplierId: { not: null } }, select: { productId: true, supplierId: true } }),
  ]);
  const quantity = new Map<string, number>();
  for (const i of order.items) quantity.set(i.productId, (quantity.get(i.productId) ?? 0) + i.quantity);
  const bySupplier = new Map<string, Set<string>>();
  for (const o of [...offers, ...pricing]) bySupplier.set(o.supplierId!, (bySupplier.get(o.supplierId!) ?? new Set()).add(o.productId));
  const covered = new Set([...bySupplier.values()].flatMap((s) => [...s]));
  result.noSupplier = order.items.filter((i) => !covered.has(i.productId)).map((i) => i.product.sku);

  const asked = new Set(order.priceRequests.map((r) => r.supplierId));
  const suppliers = await prisma.company.findMany({ where: { id: { in: [...bySupplier.keys()] } } });
  for (const supplier of suppliers) {
    if (asked.has(supplier.id)) {
      result.already.push(supplier.name);
      continue;
    }
    if (!supplier.contactEmail) {
      result.noContact.push(supplier.name);
      continue;
    }
    const items: Item[] = [...bySupplier.get(supplier.id)!].map((productId) => ({ productId, quantity: quantity.get(productId)! }));
    const messageId = await sendSiteMail({
      to: supplier.contactEmail,
      cc: SHOP_MAILBOX,
      // Replies land in the shop's mailbox, which the site reads.
      replyTo: SHOP_MAILBOX,
      subject: order.orderNumber,
      text: `${GREETING(supplier.contactName)}\n\n${ASK}\n\nЗаранее благодарим за ответ!`,
      attachments: [{ filename: sheetName(order.orderNumber), content: await requestSheet(items) }],
    });
    await prisma.priceRequest.create({
      data: { orderId, supplierId: supplier.id, email: supplier.contactEmail, contactName: supplier.contactName, items, messageId },
    });
    result.sent.push(supplier.name);
  }
  if (result.sent.length) refresh("/admin/crm/price-check");
  return result;
}

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
          for (const t of tables(m.bodyStructure as Part)) {
            const download = await client.download(String(m.uid), t.part, { uid: true });
            if (!download?.content) continue;
            const chunks: Buffer[] = [];
            for await (const c of download.content) chunks.push(c as Buffer);
            const analysis = await analyzeOfferRows(sheetRows(Buffer.concat(chunks), t.name), request.supplierId, true);
            const written = await writeOfferRows(request.supplierId, analysis.rows, false);
            const priced = written.added + written.updated;
            const analogs = analysis.rows.filter((r) => r.analog).map((r) => `${r.sku} → ${r.analog}`);
            note = [
              `Цен получено: ${priced}`,
              written.skipped && `нет в каталоге: ${analysis.rows.filter((r) => !r.productId).map((r) => r.sku).join(", ")}`,
              analogs.length && `аналоги: ${analogs.join("; ")}`,
            ]
              .filter(Boolean)
              .join("; ");
            break;
          }
          await prisma.priceRequest.update({ where: { id: request.id }, data: { answeredAt: new Date(), answerNote: note.slice(0, 1000) } });
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

export async function remindPriceRequests(): Promise<number> {
  const due = await prisma.priceRequest.findMany({
    where: { answeredAt: null, remindedAt: null, sentAt: { lt: new Date(Date.now() - DAY) } },
    include: { order: { select: { orderNumber: true } } },
  });
  for (const r of due) {
    await sendSiteMail({
      to: r.email,
      cc: SHOP_MAILBOX,
      // Replies land in the shop's mailbox, which the site reads.
      replyTo: SHOP_MAILBOX,
      subject: r.order.orderNumber,
      text: `${GREETING(r.contactName)}\n\n${ASK_AGAIN}\n\nЗаранее благодарим за ответ!`,
      attachments: [{ filename: sheetName(r.order.orderNumber), content: await requestSheet(r.items as Item[]) }],
      ...(r.messageId ? { inReplyTo: r.messageId } : {}),
    });
    await prisma.priceRequest.update({ where: { id: r.id }, data: { remindedAt: new Date() } });
  }
  return due.length;
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
    const lines = requests.map(
      (r) => `${r.supplier.name} — ${r.email} — ${r.answeredAt ? "КП получено" : "КП не получено"}${r.answerNote ? ` (${r.answerNote})` : ""}`
    );
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

/** Every half hour: replies, reminders, summaries. */
export function startPriceRequestTimer() {
  if (timerState.__emvPriceRequestTimer) return;
  timerState.__emvPriceRequestTimer = setInterval(async () => {
    for (const [name, step] of [
      ["replies", readPriceReplies],
      ["reminders", remindPriceRequests],
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
