import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { counterpartyRef, saveOneCInvoice } from "@/lib/onec-invoice";
import { renderInvoicePdf, type InvoiceData } from "@/lib/invoice-pdf";
import { deleteOrderDocumentFile, uploadOrderDocumentFile } from "@/lib/order-document-storage";
import { deliveryMethodFromNote } from "@/lib/delivery";
import { applyOrderSurcharges } from "@/lib/order-surcharge";
import { termsText } from "@/lib/supply-terms";

// «Счет на оплату» of an order: written to 1С (its number), printed from the
// shop's template into a PDF and put into the order's «Счета». A new one for
// the same order rewrites the same 1С document and replaces the file.

/** In stock: days to hand it over. */
const IN_STOCK_DAYS = 2;

const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
/** «21 сентября 2026 г.» in Moscow time. */
export function dateText(date: Date) {
  const [y, m, d] = date.toLocaleDateString("sv-SE", { timeZone: "Europe/Moscow" }).split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y} г.`;
}

/** «Населённый пункт: …\nУлица: …» of the checkout → one line of address. */
export function noteAddress(note: string | null) {
  const pick = (label: string) => note?.match(new RegExp(`${label}: ([^\\n]+)`))?.[1]?.trim();
  return [pick("Населённый пункт"), pick("Улица"), pick("Дом") && `д. ${pick("Дом")}`, pick("Офис/квартира") && `оф./кв. ${pick("Офис/квартира")}`]
    .filter(Boolean)
    .join(", ");
}

export type IssuedInvoice = { number: string; fileName: string; fileUrl: string };

export async function issueOrderInvoice(orderId: string): Promise<IssuedInvoice> {
  await applyOrderSurcharges(orderId);
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        where: { cancelled: false },
        orderBy: { id: "asc" },
        include: {
          product: { select: { id: true, sku: true, name: true, stock: true, offers: { where: { selected: true }, select: { deliveryDays: true, quality: true } } } },
          offer: { select: { deliveryDays: true, quality: true } },
        },
      },
      user: { select: { company: true } },
    },
  });
  if (!order) throw new Error("Заказ не найден");
  if (!order.items.length) throw new Error("В заказе нет позиций");
  const company =
    order.user?.company ??
    (await prisma.company.findFirst({ where: { name: { equals: order.customerName, mode: "insensitive" }, isOwn: false } }));
  if (!company) throw new Error(`Покупатель «${order.customerName}» не найден среди компаний — счёт выставляется компании`);
  if (order.items.some((i) => i.priceSnapshot <= 0)) throw new Error("В заказе есть позиции без цены (По запросу) — сначала укажите цены");

  // Срок: in stock -- 2 days; otherwise the supplier's term plus those 2 days.
  const needed = new Map<string, number>();
  for (const i of order.items) needed.set(i.productId, (needed.get(i.productId) ?? 0) + i.quantity);
  let days: number | null = IN_STOCK_DAYS;
  const qualities = new Set<string>();
  for (const i of order.items) {
    const offer = i.offer ?? i.product.offers[0] ?? null;
    if (offer?.quality) qualities.add(offer.quality);
    if (i.product.stock >= (needed.get(i.productId) ?? 0)) continue;
    if (offer?.deliveryDays == null) days = null;
    else if (days !== null) days = Math.max(days, offer.deliveryDays + IN_STOCK_DAYS);
  }

  const contractNumber = company.hasContract && company.contract ? company.contract.replace(/^№\s*/, "").trim() : null;
  const saved = await saveOneCInvoice({
    ref: order.invoiceRef,
    buyer: await counterpartyRef(company),
    contractNumber,
    lines: order.items.map((i) => ({ product: i.product, quantity: i.quantity, price: i.priceSnapshot })),
    comment: `Заказ ${order.orderNumber} с сайта emv.one`,
  });

  const method = deliveryMethodFromNote(order.deliveryNote) ?? "PICKUP";
  const terminal = order.deliveryNote?.match(/Терминал: ([^\n]+)/)?.[1]?.trim() ?? "";
  const total = order.items.reduce((s, i) => s + i.priceSnapshot * i.quantity, 0);
  const data: InvoiceData = {
    number: saved.number,
    dateText: dateText(saved.date),
    buyer: [company.name, company.inn && `ИНН ${company.inn}`, company.kpp && `КПП ${company.kpp}`, company.address].filter(Boolean).join(",  "),
    basis: contractNumber ? `Договор: ${contractNumber}` : `Заказ № ${order.orderNumber}`,
    lines: order.items.map((i) => ({
      sku: i.product.sku,
      name: i.nameSnapshot,
      quantity: i.quantity,
      unit: "шт",
      price: i.priceSnapshot,
      sum: i.priceSnapshot * i.quantity,
    })),
    vatRate: saved.vatRate,
    vat: saved.vat,
    total,
    terms: termsText({
      prepay: company.paymentType !== "DEFERRED",
      contract: company.hasContract,
      days,
      deferralDays: company.paymentDeferralDays,
      quality: qualities.size ? [...qualities].join(", ") : null,
      method,
      address: method === "TERMINAL" ? terminal : noteAddress(order.deliveryNote) || (company.address ?? ""),
    }),
  };
  const pdf = await renderInvoicePdf(data);
  const fileName = `Счет на оплату № ${saved.number} от ${data.dateText}.pdf`;

  // The previous file of this invoice goes.
  const old = await prisma.orderDocument.findMany({
    where: { orderId, category: "INVOICE", fileName: { startsWith: `Счет на оплату № ${saved.number} от` } },
  });
  for (const d of old) {
    await deleteOrderDocumentFile(d.fileUrl);
    await prisma.orderDocument.delete({ where: { id: d.id } });
  }
  const fileUrl = await uploadOrderDocumentFile(orderId, "INVOICE", pdf, fileName);
  await prisma.$transaction([
    prisma.orderDocument.create({ data: { orderId, category: "INVOICE", fileName, fileUrl } }),
    prisma.order.update({
      where: { id: orderId },
      data: { invoiceRef: saved.ref, invoiceNumber: saved.number, invoiceDate: saved.date },
    }),
  ]);
  revalidatePath("/admin/crm/orders");
  return { number: saved.number, fileName, fileUrl };
}
