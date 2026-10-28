import "server-only";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { ImapFlow } from "imapflow";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { sendSiteMail } from "@/lib/mailer";
import { mailboxes, requestSheet, SHOP_MAILBOX } from "@/lib/price-requests";
import { requestForPurchase } from "@/lib/payment-requests";

// Заказ поставщику. Lines in «Заказать» (the purchase is agreed: the
// customer paid or is on deferral) go to their supplier -- one letter per
// supplier and customer order, the Excel sheet sorted by brand, the text for
// a Saint Petersburg supplier or one in another city. The planned delivery
// date is set on the lines and the customer's. The supplier's reply with an
// invoice puts it into the order's files and the lines into «Требуется оплата».

const DAY = 24 * 60 * 60 * 1000;
const TIMER_MS = 30 * 60 * 1000;
const FILES_DIR = path.join(process.cwd(), "public", "uploads", "supplier-purchases");

const inSaintPetersburg = (address: string | null) => /санкт[\s-]*петербург|\bспб\b|г\.?\s*пушкин|колпино|павловск/i.test(address ?? "");

function letterText(contactName: string | null, spb: boolean) {
  const hello = contactName ? `Добрый день, ${contactName}!` : "Добрый день!";
  const ask = "Просим предоставить счёт на оплату по заказу во вложении – заполните таблицу и направьте ответным письмом.";
  const delivery = spb
    ? "Просим проинформировать нас по факту поступления товара и сообщить адрес склада и рабочее время."
    : "Просим сообщить по факту поступления товара на склад, а также передать товар в ТК «Деловые линии» с доставкой до терминала Кубинская (Санкт-Петербург).";
  return `${hello}\n\n${ask}\n${delivery}\n\nЗаранее благодарим!`;
}

function refresh(...paths: string[]) {
  for (const p of paths) {
    try {
      revalidatePath(p);
    } catch {
      // not in a request
    }
  }
}

export type PurchasesSent = { sent: string[]; noContact: string[]; noSupplier: number };

/**
 * Sends the lines in «Заказать» not sent yet (all, or just `lineIds`):
 * grouped by supplier and customer order. Suppliers without the contact
 * e-mail and lines without a supplier are listed back.
 */
export async function sendSupplierOrders(lineIds?: string[]): Promise<PurchasesSent> {
  const lines = await prisma.supplierOrderLine.findMany({
    where: { status: "TO_ORDER", purchaseId: null, ...(lineIds ? { id: { in: lineIds } } : {}) },
    include: { supplier: true, orderItem: { select: { id: true, order: { select: { id: true, orderNumber: true } } } } },
  });
  const result: PurchasesSent = { sent: [], noContact: [], noSupplier: lines.filter((l) => !l.supplierId).length };
  const groups = new Map<string, typeof lines>();
  for (const l of lines) {
    if (!l.supplier) continue;
    const key = `${l.supplierId}|${l.orderItem?.order.id ?? ""}`;
    groups.set(key, [...(groups.get(key) ?? []), l]);
  }
  for (const group of groups.values()) {
    const supplier = group[0].supplier!;
    if (!supplier.contactEmail) {
      if (!result.noContact.includes(supplier.name)) result.noContact.push(supplier.name);
      continue;
    }
    const order = group[0].orderItem?.order ?? null;
    const purchase = await prisma.supplierPurchase.create({
      data: { supplierId: supplier.id, orderId: order?.id ?? null, email: supplier.contactEmail, contactName: supplier.contactName },
    });
    const subject = order?.orderNumber ?? `Заказ поставщику № ${purchase.number}`;
    const items = group.map((l) => ({ productId: l.productId, quantity: l.quantity }));
    const messageId = await sendSiteMail({
      to: supplier.contactEmail,
      cc: SHOP_MAILBOX,
      replyTo: SHOP_MAILBOX,
      subject,
      text: letterText(supplier.contactName, inSaintPetersburg(supplier.address)),
      attachments: [{ filename: `Заказ ${subject.replace(/\//g, "-")}.xlsx`, content: await requestSheet(items) }],
    });
    const now = new Date();
    await prisma.supplierPurchase.update({ where: { id: purchase.id }, data: { messageId, sentAt: now } });
    for (const l of group) {
      await prisma.supplierOrderLine.update({ where: { id: l.id }, data: { purchaseId: purchase.id } });
      // The customer sees when it is expected: the supplier's term from today.
      if (l.orderItem && l.deliveryDays != null) {
        await prisma.orderItem.update({ where: { id: l.orderItem.id }, data: { deliveryDate: new Date(now.getTime() + l.deliveryDays * DAY) } });
      }
    }
    result.sent.push(`${supplier.name} (${subject})`);
  }
  if (result.sent.length) refresh("/admin/crm/supplier-orders", "/admin/crm/orders");
  return result;
}

/** Stores a file of a supplier order; an invoice makes its lines «Требуется оплата». */
export async function addPurchaseFile(purchaseId: string, kind: "INVOICE" | "PAYMENT" | "OTHER", name: string, content: Buffer) {
  const dir = path.join(FILES_DIR, purchaseId);
  await mkdir(dir, { recursive: true });
  const stored = `${Date.now()}-${crypto.randomUUID()}${path.extname(name)}`;
  await writeFile(path.join(dir, stored), content);
  const file = await prisma.supplierPurchaseFile.create({ data: { purchaseId, kind, fileName: name, fileUrl: `/uploads/supplier-purchases/${purchaseId}/${stored}` } });
  if (kind === "INVOICE") {
    await prisma.supplierPurchase.update({ where: { id: purchaseId }, data: { invoiceAt: new Date() } });
    await prisma.supplierOrderLine.updateMany({ where: { purchaseId, status: { in: ["TO_ORDER"] } }, data: { status: "AWAITING_PAYMENT" } });
    // Финансы → Заявки на оплату.
    await requestForPurchase(purchaseId, { fileName: file.fileName, fileUrl: file.fileUrl });
  }
}

type Part = { part?: string; dispositionParameters?: { filename?: string }; parameters?: { name?: string }; childNodes?: Part[] };
const attachments = (p: Part | undefined): { part: string; name: string }[] => {
  if (!p) return [];
  const name = p.dispositionParameters?.filename ?? p.parameters?.name ?? "";
  const own = p.part && /\.(pdf|xlsx?|ods|jpe?g|png|docx?)$/i.test(name) ? [{ part: p.part, name }] : [];
  return [...own, ...(p.childNodes ?? []).flatMap(attachments)];
};

/** Supplier replies with an invoice, in either mailbox. */
export async function readSupplierInvoices(): Promise<number> {
  const open = await prisma.supplierPurchase.findMany({
    where: { sentAt: { not: null }, invoiceAt: null },
    include: { order: { select: { orderNumber: true } } },
    orderBy: { sentAt: "asc" },
  });
  if (!open.length) return 0;
  const since = new Date(open[0].sentAt!.getTime() - DAY);
  let got = 0;
  for (const box of await mailboxes()) {
    const client = new ImapFlow({ host: box.host, port: box.port, secure: box.port === 993, auth: { user: box.user, pass: box.pass }, logger: false });
    try {
      await client.connect();
      const lock = await client.getMailboxLock("INBOX");
      try {
        const uids = (await client.search({ since }, { uid: true })) || [];
        const letters = [];
        if (uids.length) for await (const m of client.fetch(uids, { envelope: true, bodyStructure: true }, { uid: true })) letters.push(m);
        for (const m of letters) {
          const from = m.envelope?.from?.[0]?.address?.toLowerCase() ?? "";
          const waiting = open.filter((p) => !p.invoiceAt && p.email && (p.email === from || p.email.split("@")[1] === from.split("@")[1]));
          if (!waiting.length) continue;
          const subject = m.envelope?.subject ?? "";
          const purchase =
            waiting.find((p) => p.messageId && m.envelope?.inReplyTo?.includes(p.messageId)) ??
            waiting.find((p) => subject.includes(p.order?.orderNumber ?? `№ ${p.number}`)) ??
            (waiting.length === 1 ? waiting[0] : null);
          if (!purchase || (m.envelope?.date && m.envelope.date < purchase.sentAt!)) continue;
          const files = attachments(m.bodyStructure as Part);
          if (!files.length) continue;
          for (const f of files) {
            const download = await client.download(String(m.uid), f.part, { uid: true });
            if (!download?.content) continue;
            const chunks: Buffer[] = [];
            for await (const c of download.content) chunks.push(c as Buffer);
            await addPurchaseFile(purchase.id, "INVOICE", f.name, Buffer.concat(chunks));
          }
          purchase.invoiceAt = new Date();
          got++;
        }
      } finally {
        lock.release();
      }
    } catch (error) {
      console.error("[supplier-purchases] mailbox", box.user, error);
    } finally {
      await client.logout().catch(() => {});
    }
  }
  if (got) refresh("/admin/crm/supplier-orders");
  return got;
}

const timerState = globalThis as unknown as { __emvPurchaseTimer?: NodeJS.Timeout };

/** Every half hour: new agreed lines go out, invoices come in. */
export function startSupplierPurchaseTimer() {
  if (timerState.__emvPurchaseTimer) return;
  timerState.__emvPurchaseTimer = setInterval(async () => {
    for (const [name, step] of [
      ["send", () => sendSupplierOrders()],
      ["invoices", readSupplierInvoices],
    ] as const) {
      try {
        await step();
      } catch (error) {
        console.error(`[supplier-purchases] ${name}`, error);
      }
    }
  }, TIMER_MS);
}
