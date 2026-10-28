import "server-only";
import { createHash } from "crypto";
import { readFileSync } from "fs";
import https from "https";
import path from "path";
import tls from "tls";
import type { BankAccount } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/secret-box";
import { applyPaymentTerms, refreshOrder } from "@/lib/order-status";
import { matchOutgoing } from "@/lib/payment-requests";

// Банки: the shop's statements come in -- Точка by its Open API (on the
// account's schedule and by «Выгрузить сейчас»), others as a 1С «Клиент-банк» file -- and an
// incoming payment is matched with the order it pays: the payer's ИНН is
// the order company's, and the purpose names the invoice (or the order), or
// the amount is that of the company's only unpaid order. A full payment
// marks the order paid as «Оплачено» in CRM does.

const TOCHKA = "https://enter.tochka.com/uapi/open-banking/v1.0";
const DAY = 24 * 60 * 60 * 1000;

export const BANK_KINDS = { TOCHKA_API: "Точка — по API", STATEMENT_FILE: "Выписка 1С (файл)" } as const;

export type StatementLine = {
  externalId: string;
  date: Date;
  incoming: boolean;
  /** kopecks */
  amount: number;
  counterpartyName: string | null;
  counterpartyInn: string | null;
  purpose: string | null;
  documentNumber: string | null;
};

// ---- Точка ---------------------------------------------------------------------

type TochkaTx = {
  transactionId?: string;
  paymentId?: string;
  creditDebitIndicator: "Credit" | "Debit";
  status?: string;
  documentNumber?: string;
  documentProcessDate?: string;
  description?: string;
  Amount?: { amount?: number; amountNat?: number };
  DebtorParty?: { inn?: string; name?: string };
  CreditorParty?: { inn?: string; name?: string };
};

// Точка's certificate is issued by the Минцифры CA (Russian Trusted Root CA,
// gu-st.ru), which isn't among Node's roots: it is trusted for these calls only.
let bankCa: string[] | null = null;
function caList() {
  bankCa ??= [
    ...tls.rootCertificates,
    ...["russian_trusted_root_ca.crt", "russian_trusted_sub_ca.crt"].map((f) => readFileSync(path.join(process.cwd(), "assets", "certs", f), "utf8")),
  ];
  return bankCa;
}

async function tochka<T>(token: string, url: string, init?: { method?: string; body?: string }): Promise<T> {
  const { status, text } = await new Promise<{ status: number; text: string }>((resolve, reject) => {
    const request = https.request(
      `${TOCHKA}${url}`,
      {
        method: init?.method ?? "GET",
        ca: caList(),
        timeout: 30_000,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (c: Buffer) => chunks.push(c));
        response.on("end", () => resolve({ status: response.statusCode ?? 0, text: Buffer.concat(chunks).toString("utf8") }));
      }
    );
    request.on("timeout", () => request.destroy(new Error("Точка не ответила за 30 секунд")));
    request.on("error", reject);
    if (init?.body) request.write(init.body);
    request.end();
  });
  if (status === 401 || status === 403) throw new Error("Точка не приняла токен — выпустите новый в «Интеграции и API» (с правом на выписки)");
  if (status < 200 || status >= 300) throw new Error(`Точка ответила ${status}: ${text.slice(0, 300)}`);
  return JSON.parse(text) as T;
}

/** The statement of the account for the period, waited for (the bank builds it in the background). */
async function tochkaStatement(account: BankAccount, from: Date, to: Date): Promise<StatementLine[]> {
  if (!account.tokenEnc) throw new Error("Не задан токен Точки");
  const token = decryptSecret(account.tokenEnc);
  // The bank's id of the account is «номер/БИК»; taken from its list to be sure.
  const accounts = await tochka<{ Data?: { Account?: { accountId: string }[] } }>(token, "/accounts");
  const accountId =
    accounts.Data?.Account?.find((a) => a.accountId.startsWith(account.accountNumber))?.accountId ??
    `${account.accountNumber}/${account.bik ?? ""}`;
  const day = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Moscow" });
  const init = await tochka<{ Data: { Statement: { statementId: string } } }>(token, "/statements", {
    method: "POST",
    body: JSON.stringify({ Data: { Statement: { accountId, startDateTime: day(from), endDateTime: day(to) } } }),
  });
  const id = init.Data.Statement.statementId;
  for (let attempt = 0; attempt < 20; attempt++) {
    await new Promise((r) => setTimeout(r, attempt ? 3000 : 1500));
    const got = await tochka<{ Data: { Statement: { status: string; Transaction?: TochkaTx[] }[] } }>(
      token,
      `/accounts/${encodeURIComponent(accountId)}/statements/${encodeURIComponent(id)}`
    );
    const statement = got.Data.Statement[0];
    if (statement?.status === "Error") throw new Error("Точка не смогла сформировать выписку");
    if (statement?.status !== "Ready") continue;
    return (statement.Transaction ?? []).map((t) => {
      const incoming = t.creditDebitIndicator === "Credit";
      const party = incoming ? t.DebtorParty : t.CreditorParty;
      return {
        externalId: t.transactionId || t.paymentId || `${t.documentProcessDate}|${t.documentNumber}|${t.Amount?.amount}`,
        date: new Date(`${t.documentProcessDate ?? day(new Date())}T12:00:00+03:00`),
        incoming,
        amount: Math.round((t.Amount?.amountNat ?? t.Amount?.amount ?? 0) * 100),
        counterpartyName: party?.name ?? null,
        counterpartyInn: party?.inn ?? null,
        purpose: t.description ?? null,
        documentNumber: t.documentNumber ?? null,
      };
    });
  }
  throw new Error("Точка не успела сформировать выписку — попробуйте ещё раз через минуту");
}

// ---- 1С «Клиент-банк» file -------------------------------------------------------------

/** kl_to_1c.txt is usually Windows-1251; UTF-8 is taken as is. */
function decodeStatement(buffer: Buffer): string {
  const utf8 = buffer.toString("utf8");
  return utf8.includes("1CClientBankExchange") && !utf8.includes("�") ? utf8 : new TextDecoder("windows-1251").decode(buffer);
}

const parseRuDate = (s: string | undefined) => {
  const m = s?.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  return m ? new Date(`${m[3]}-${m[2]}-${m[1]}T12:00:00+03:00`) : null;
};

/** The documents of a 1С «Клиент-банк» statement that move money on this account. */
export function parseClientBankStatement(buffer: Buffer, accountNumber: string): StatementLine[] {
  const text = decodeStatement(buffer);
  if (!text.includes("1CClientBankExchange")) throw new Error("Это не выписка в формате 1С (kl_to_1c.txt)");
  const lines: StatementLine[] = [];
  for (const block of text.split(/^СекцияДокумент=/m).slice(1)) {
    const body = block.split(/^КонецДокумента/m)[0];
    const f = Object.fromEntries(
      body.split(/\r?\n/).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()] as const).filter(([k]) => k)
    );
    const incoming = f.ПолучательСчет === accountNumber || f.ПолучательРасчСчет === accountNumber;
    const outgoing = f.ПлательщикСчет === accountNumber || f.ПлательщикРасчСчет === accountNumber;
    if (!incoming && !outgoing) continue;
    const date = parseRuDate(incoming ? f.ДатаПоступило : f.ДатаСписано) ?? parseRuDate(f.Дата);
    if (!date) continue;
    const amount = Math.round(Number((f.Сумма ?? "0").replace(",", ".")) * 100);
    const inn = (incoming ? f.ПлательщикИНН : f.ПолучательИНН) || null;
    lines.push({
      externalId: createHash("sha1").update([f.Дата, f.Номер, amount, inn, incoming].join("|")).digest("hex"),
      date,
      incoming,
      amount,
      counterpartyName: ((incoming ? f.Плательщик1 || f.Плательщик : f.Получатель1 || f.Получатель) ?? "").replace(/^ИНН \d+\s*/, "") || null,
      counterpartyInn: inn,
      purpose: f.НазначениеПлатежа || null,
      documentNumber: f.Номер || null,
    });
  }
  return lines;
}

// ---- Matching ----------------------------------------------------------------------------

/** «сч. 583», «счету № 583 от 26.10.2026», «по счёту на оплату №583», a site order «261026/1». */
function namedNumbers(purpose: string) {
  const invoices = [...purpose.matchAll(/сч(?:[её]т|\.)?[а-я]*\s*(?:на\s+оплату\s*)?(?:№|N|#)?\s*(?:НФНФ-0*|0000-0*)?(\d{1,6})(?!\d|\/)/gi)].map((m) => m[1]);
  const orders = [...purpose.matchAll(/(\d{6}\/\d{1,3})/g)].map((m) => m[1]);
  return { invoices, orders };
}

const ACTIVE_LINE = { cancelled: false } as const;

/** What the order still waits to be paid, kopecks. */
async function unpaidOf(orderId: string) {
  const lines = await prisma.orderItem.findMany({ where: { orderId, ...ACTIVE_LINE, paid: false }, select: { priceSnapshot: true, quantity: true } });
  return lines.reduce((s, l) => s + l.priceSnapshot * l.quantity, 0);
}

/** Matches an incoming payment; a full one marks the order's lines paid. Returns the note. */
async function matchPayment(tx: { id: string; amount: number; date: Date; counterpartyInn: string | null; purpose: string | null }): Promise<string> {
  if (!tx.counterpartyInn) return "Плательщик без ИНН";
  const companies = await prisma.company.findMany({ where: { inn: tx.counterpartyInn, isOwn: false }, select: { name: true, users: { select: { id: true } } } });
  if (!companies.length) return "Плательщика нет среди компаний сайта";
  const orders = await prisma.order.findMany({
    where: {
      OR: [{ customerName: { in: companies.map((c) => c.name), mode: "insensitive" } }, { userId: { in: companies.flatMap((c) => c.users.map((u) => u.id)) } }],
      status: { not: "CANCELLED" },
      items: { some: { ...ACTIVE_LINE, paid: false } },
    },
    select: { id: true, orderNumber: true, invoiceNumber: true, invoiceDate: true },
    orderBy: { createdAt: "desc" },
  });
  if (!orders.length) return "У плательщика нет неоплаченных заказов";

  const { invoices, orders: orderNumbers } = namedNumbers(tx.purpose ?? "");
  const yearAgo = new Date(tx.date.getTime() - 365 * DAY);
  let order =
    orders.find((o) => o.invoiceNumber && invoices.includes(o.invoiceNumber) && (!o.invoiceDate || o.invoiceDate > yearAgo)) ??
    orders.find((o) => orderNumbers.includes(o.orderNumber));
  let how = order ? "по номеру в назначении" : "";
  if (!order && invoices.length) {
    // The invoice named is of an order already marked paid (from 1С, or by hand).
    const settled = await prisma.order.findFirst({
      where: { invoiceNumber: { in: invoices }, invoiceDate: { gt: yearAgo }, customerName: { in: companies.map((c) => c.name), mode: "insensitive" } },
      select: { id: true, orderNumber: true },
    });
    if (settled) {
      await prisma.bankTransaction.update({ where: { id: tx.id }, data: { orderId: settled.id } });
      return `Заказ ${settled.orderNumber} уже отмечен оплаченным`;
    }
  }
  // A number is named but matches nothing: by hand, not by the sum.
  if (!order && (invoices.length || orderNumbers.length)) {
    return `В назначении счёт/заказ ${[...invoices, ...orderNumbers].join(", ")} — такого неоплаченного на сайте нет, проверьте вручную`;
  }
  if (!order) {
    const sameSum = [];
    for (const o of orders) if (Math.abs((await unpaidOf(o.id)) - tx.amount) < 100) sameSum.push(o);
    if (sameSum.length === 1) {
      order = sameSum[0];
      how = "по сумме (единственный такой заказ)";
    } else return sameSum.length ? `Подходит ${sameSum.length} заказа по сумме — выберите вручную` : "Заказ не найден: в назначении нет номера счёта, сумма не совпала";
  }

  await prisma.bankTransaction.update({ where: { id: tx.id }, data: { orderId: order.id } });
  const due = await unpaidOf(order.id);
  if (tx.amount + 100 < due) return `Заказ ${order.orderNumber} ${how}: частичная оплата (${(tx.amount / 100).toFixed(2)} из ${(due / 100).toFixed(2)} ₽) — отметьте вручную`;
  await prisma.orderItem.updateMany({ where: { orderId: order.id, ...ACTIVE_LINE, paid: false }, data: { paid: true } });
  await refreshOrder(prisma, order.id);
  await applyPaymentTerms(order.id);
  return `Заказ ${order.orderNumber} оплачен ${how}`;
}

/** Stores the statement's lines (once each): new incoming ones pay orders, outgoing ones close payment requests. */
export async function saveStatement(accountId: string, lines: StatementLine[]) {
  let added = 0;
  let paid = 0;
  for (const line of lines) {
    const exists = await prisma.bankTransaction.findUnique({ where: { bankAccountId_externalId: { bankAccountId: accountId, externalId: line.externalId } } });
    if (exists) continue;
    const tx = await prisma.bankTransaction.create({ data: { ...line, bankAccountId: accountId } });
    added++;
    if (!line.incoming) {
      const note = await matchOutgoing(tx).catch((e) => `Ошибка сопоставления: ${(e as Error).message}`);
      if (note) await prisma.bankTransaction.update({ where: { id: tx.id }, data: { matchNote: note } });
      continue;
    }
    const note = await matchPayment(tx).catch((e) => `Ошибка сопоставления: ${(e as Error).message}`);
    if (/ оплачен /.test(note)) paid++;
    await prisma.bankTransaction.update({ where: { id: tx.id }, data: { matchNote: note } });
  }
  return { added, paid };
}

/** Точка: from a few days before the last pull (or a month back the first time) to now. */
export async function syncBankAccount(id: string) {
  const account = await prisma.bankAccount.findUniqueOrThrow({ where: { id } });
  if (account.kind !== "TOCHKA_API") throw new Error("Этот счёт загружается файлом выписки");
  const from = new Date((account.lastSyncAt?.getTime() ?? Date.now() - 30 * DAY) - 3 * DAY);
  try {
    const r = await saveStatement(id, await tochkaStatement(account, from, new Date()));
    const note = `Новых операций: ${r.added}, оплачено заказов: ${r.paid}`;
    await prisma.bankAccount.update({ where: { id }, data: { lastSyncAt: new Date(), lastSyncNote: note } });
    return note;
  } catch (error) {
    const note = `Ошибка: ${error instanceof Error ? error.message : "банк не ответил"}`;
    await prisma.bankAccount.update({ where: { id }, data: { lastSyncNote: note } });
    throw error;
  }
}

const timerState = globalThis as unknown as { __emvBankTimer?: NodeJS.Timeout };

/** «10, 14,20» → [10, 14, 20]: whole Moscow hours, sorted, once each. */
export function parseSyncHours(text: string): number[] {
  const hours = (text.match(/\d+/g) ?? []).map(Number).filter((h) => h >= 0 && h <= 23);
  return [...new Set(hours)].sort((a, b) => a - b);
}

/**
 * Точка on each account's schedule (Настройки → Банки → «График выгрузки»):
 * checked every minute, an account is pulled in the first minutes of each
 * of its hours, unless it was pulled within the last half hour.
 */
export function startBankTimer() {
  if (timerState.__emvBankTimer) return;
  timerState.__emvBankTimer = setInterval(async () => {
    const msk = new Date(Date.now() + 3 * 60 * 60 * 1000);
    if (msk.getUTCMinutes() > 5) return;
    const accounts = await prisma.bankAccount
      .findMany({ where: { kind: "TOCHKA_API", isActive: true }, select: { id: true, syncHours: true, lastSyncAt: true } })
      .catch(() => []);
    for (const a of accounts) {
      if (!parseSyncHours(a.syncHours).includes(msk.getUTCHours())) continue;
      if (a.lastSyncAt && Date.now() - a.lastSyncAt.getTime() < 30 * 60 * 1000) continue;
      try {
        console.log("[banks]", await syncBankAccount(a.id));
      } catch (error) {
        console.error("[banks] sync failed", error);
      }
    }
  }, 60 * 1000);
}
