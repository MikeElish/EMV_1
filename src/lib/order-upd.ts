import "server-only";
import { prisma } from "@/lib/prisma";
import { counterpartyRef } from "@/lib/onec-invoice";
import { createOneCSale } from "@/lib/onec-sale";
import { afterWrite } from "@/lib/onec-stock-docs";
import { dateText, noteAddress } from "@/lib/order-invoice";
import { renderUpdPdf } from "@/lib/upd-pdf";
import { uploadOrderDocumentFile } from "@/lib/order-document-storage";
import { SHIPPED_STATUSES } from "@/lib/validators/orders";

// The УПД of what an order shipped from Склад → Выдача: the Реализация and
// its Счет-фактура in 1С, the PDF into the order's «УПД». Each line is
// shipped by one Реализация (OrderItem.saleRef: "" while waiting), so a retry
// does only the rest, and lines shipped before (by hand) never go in.

const ruDate = (d: Date) => d.toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" });

/** Lines handed over in Выдача that have no УПД yet. */
export function pendingUpdItems(orderId: string) {
  return prisma.orderItem.findMany({
    where: { orderId, status: { in: SHIPPED_STATUSES }, saleRef: "" },
    orderBy: { id: "asc" },
    include: { product: { select: { id: true, sku: true, name: true } } },
  });
}

export async function issueOrderUpd(orderId: string): Promise<{ number: string; fileName: string }> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { company: true } },
      bankTransactions: { where: { incoming: true }, select: { documentNumber: true, date: true } },
    },
  });
  if (!order) throw new Error("Заказ не найден");
  const items = await pendingUpdItems(orderId);
  if (!items.length) throw new Error("Нет отгруженных позиций без УПД");
  const company =
    order.user?.company ?? (await prisma.company.findFirst({ where: { name: { equals: order.customerName, mode: "insensitive" }, isOwn: false } }));
  if (!company) throw new Error(`Покупатель «${order.customerName}» не найден среди компаний — УПД оформляется компании`);
  const contractNumber = company.hasContract && company.contract ? company.contract.replace(/^№\s*/, "").trim() : null;

  const sale = await createOneCSale({
    buyer: await counterpartyRef(company),
    contractNumber,
    invoiceRef: order.invoiceRef,
    lines: items.map((i) => ({ product: i.product, quantity: i.quantity, price: i.priceSnapshot })),
    comment: `Заказ ${order.orderNumber} с сайта emv.one`,
  });
  await prisma.orderItem.updateMany({ where: { id: { in: items.map((i) => i.id) } }, data: { saleRef: sale.saleRef } });

  const terminal = order.deliveryNote?.match(/Терминал: ([^\n]+)/)?.[1]?.trim();
  const address = company.address ?? "";
  const delivery = terminal ? `терминал ТК: ${terminal}` : noteAddress(order.deliveryNote);
  const pdf = await renderUpdPdf({
    number: sale.number,
    dateText: dateText(sale.date),
    date: ruDate(sale.date),
    shipmentNumber: sale.saleNumber,
    buyer: { name: company.name, address, inn: company.inn ?? "", kpp: company.kpp ?? "" },
    consignee: [company.name, delivery || address].filter(Boolean).join(", "),
    payments: order.bankTransactions.map((t) => `${t.documentNumber ?? "б/н"} от ${ruDate(t.date)}`).join(", "),
    basis: contractNumber
      ? `Договор № ${contractNumber}`
      : order.invoiceNumber
        ? `Счет на оплату № ${order.invoiceNumber}${order.invoiceDate ? ` от ${ruDate(order.invoiceDate)}` : ""}`
        : `Заказ № ${order.orderNumber}`,
    transport: order.handover === "Передан в ТК" ? (order.handoverNote ?? "") : "",
    vatRate: sale.vatRate,
    lines: items.map((i, n) => ({ sku: i.product.sku, name: i.nameSnapshot, quantity: i.quantity, price: i.priceSnapshot, vat: sale.lineVat[n] })),
  });
  const fileName = `УПД № ${sale.number} от ${ruDate(sale.date)}.pdf`;
  const fileUrl = await uploadOrderDocumentFile(orderId, "UPD", pdf, fileName);
  await prisma.orderDocument.create({ data: { orderId, category: "UPD", fileName, fileUrl } });
  // 1С has written the goods off: «Наличие» follows.
  await afterWrite();
  return { number: sale.number, fileName };
}
