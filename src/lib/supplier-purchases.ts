import "server-only";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { ImapFlow } from "imapflow";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { mailboxes } from "@/lib/price-requests";
import { requestForPurchase } from "@/lib/payment-requests";

// Supplier requests and purchase links are sent only after an administrator
// confirms them. This module handles supplier invoice files and replies.

const DAY = 24 * 60 * 60 * 1000;
const TIMER_MS = 30 * 60 * 1000;
const FILES_DIR = path.join(process.cwd(), "public", "uploads", "supplier-purchases");

function refresh(...paths: string[]) {
  for (const p of paths) {
    try {
      revalidatePath(p);
    } catch {
      // not in a request
    }
  }
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
  if (got) refresh("/admin/crm/supplier-orders", "/admin/warehouse/replenishment");
  return got;
}

const timerState = globalThis as unknown as { __emvPurchaseTimer?: NodeJS.Timeout };

/** Every half hour: check the supplier mailbox for invoices; never send messages. */
export function startSupplierPurchaseTimer() {
  if (timerState.__emvPurchaseTimer) return;
  timerState.__emvPurchaseTimer = setInterval(async () => {
    try {
      await readSupplierInvoices();
    } catch (error) {
      console.error("[supplier-purchases] invoices", error);
    }
  }, TIMER_MS);
}
