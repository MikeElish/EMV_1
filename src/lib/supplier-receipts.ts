import "server-only";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { OneCError } from "@/lib/onec";
import { createOneCReceipt } from "@/lib/onec-purchase";
import { afterWrite } from "@/lib/onec-stock-docs";
import { refreshOrder, setLineStatuses } from "@/lib/order-status";
import { uploadOrderDocumentFile } from "@/lib/order-document-storage";
import { createSupplyTask } from "@/lib/task-automation";
import { settleHandedOver } from "@/lib/cash-receipts";
import type { HandoverKind } from "@/lib/validators/receipts";

// Склад → Поступление and Выдача.
// Поступление: the supplier's УПД for lines of its supplier orders -- written
// and posted in 1С, the lines «Поставлено», the customers' lines «Готов к
// отгрузке» (they are told), the УПД into the supplier orders' files.
// Выдача: the order's lines ready to ship are handed over (or passed to a
// transport company with its ТН): paid ones «Завершено», the rest
// «Отгружено, требуется оплата».

const FILES_DIR = path.join(process.cwd(), "public", "uploads", "supplier-receipts");

/** Supplier order lines that may still arrive. */
export const RECEIVABLE = ["TO_ORDER", "AWAITING_PAYMENT", "ORDERED"] as const;

export type ReceiveInput = {
  supplierId: string;
  warehouseRef: string;
  docNumber: string;
  docDate: Date;
  vatRate: string;
  /** price -- kopecks per unit, as in the УПД */
  lines: { lineId: string; price: number }[];
  note: string;
  file: { name: string; content: Buffer } | null;
};

export async function receiveGoods(input: ReceiveInput) {
  const supplier = await prisma.company.findUnique({ where: { id: input.supplierId }, select: { id: true, oneCRef: true, inn: true, name: true } });
  if (!supplier) throw new OneCError("Поставщик не найден");
  const lines = await prisma.supplierOrderLine.findMany({
    where: { id: { in: input.lines.map((l) => l.lineId) }, supplierId: supplier.id, receiptId: null, status: { in: [...RECEIVABLE] } },
    include: {
      product: { select: { id: true, sku: true, name: true } },
      orderItem: { select: { id: true, orderId: true, status: true } },
      purchase: { select: { number: true } },
    },
  });
  if (!lines.length) throw new OneCError("Отметьте поступившие позиции");
  const priceOf = new Map(input.lines.map((l) => [l.lineId, l.price]));
  const purchases = [...new Set(lines.flatMap((l) => (l.purchase ? [l.purchase.number] : [])))];

  const doc = await createOneCReceipt({
    supplier,
    warehouseRef: input.warehouseRef,
    docNumber: input.docNumber,
    docDate: input.docDate,
    vatRate: input.vatRate,
    lines: lines.map((l) => ({ product: l.product, quantity: l.quantity, price: priceOf.get(l.id) ?? l.price })),
    comment: ["Сайт: поступление", purchases.length && `по заказам поставщику № ${purchases.join(", ")}`, input.note].filter(Boolean).join(" "),
  });

  const receipt = await prisma.supplierReceipt.create({
    data: {
      supplierId: supplier.id,
      warehouseRef: input.warehouseRef,
      docNumber: input.docNumber,
      docDate: input.docDate,
      vatRate: input.vatRate,
      amount: lines.reduce((s, l) => s + (priceOf.get(l.id) ?? l.price) * l.quantity, 0),
      oneCRef: doc.ref,
      oneCNumber: doc.number,
      note: input.note || null,
    },
  });
  if (input.file) {
    const dir = path.join(FILES_DIR, receipt.id);
    await mkdir(dir, { recursive: true });
    const stored = `${Date.now()}-${crypto.randomUUID()}${path.extname(input.file.name)}`;
    await writeFile(path.join(dir, stored), input.file.content);
    const fileUrl = `/uploads/supplier-receipts/${receipt.id}/${stored}`;
    await prisma.supplierReceipt.update({ where: { id: receipt.id }, data: { fileName: input.file.name, fileUrl } });
    for (const purchaseId of new Set(lines.flatMap((l) => (l.purchaseId ? [l.purchaseId] : [])))) {
      await prisma.supplierPurchaseFile.create({ data: { purchaseId, kind: "OTHER", fileName: `УПД ${input.file.name}`, fileUrl } });
    }
  }

  for (const l of lines) {
    await prisma.supplierOrderLine.update({ where: { id: l.id }, data: { receiptId: receipt.id, status: "DELIVERED", price: priceOf.get(l.id) ?? l.price } });
  }
  // The customers' lines: the goods are here.
  const byOrder = new Map<string, string[]>();
  for (const l of lines) {
    const item = l.orderItem;
    if (!item || !["AWAITING_SUPPLY", "IN_PROGRESS"].includes(item.status)) continue;
    byOrder.set(item.orderId, [...(byOrder.get(item.orderId) ?? []), item.id]);
  }
  for (const [orderId, ids] of byOrder) {
    await setLineStatuses(orderId, ids.map((itemId) => ({ itemId, status: "READY_TO_SHIP" as OrderStatus })), { notify: true });
  }
  // Spawn tasks for the managers of the customer orders that received goods.
  const orderLines = new Map<string, typeof lines>();
  for (const l of lines) {
    const orderId = l.orderItem?.orderId;
    if (!orderId) continue;
    const list = orderLines.get(orderId) ?? [];
    list.push(l);
    orderLines.set(orderId, list);
  }
  const supplierOrderNumbers = purchases.length ? purchases.join(", ") : doc.number;
  for (const [orderId, list] of orderLines) {
    const itemsText = list.map((l) => `· ${l.product.name} — ${l.quantity} шт.`).join("\n");
    await createSupplyTask(orderId, supplierOrderNumbers, itemsText).catch((e) => console.error("[supply-task]", e));
  }
  await afterWrite();
  return { receipt, oneCNumber: doc.number, orders: byOrder.size };
}

/** Выдача: the order's lines ready to ship leave the warehouse. */
export async function handOverOrder(input: {
  orderId: string;
  kind: HandoverKind;
  note: string;
  file: { name: string; content: Buffer } | null;
  quantities?: Record<string, number>;
  documentCategory?: "UPD" | "WAYBILL";
}) {
  const items = await prisma.orderItem.findMany({
    where: { orderId: input.orderId, status: "READY_TO_SHIP" },
    include: {
      product: { select: { stock: true } },
      supplierOrderLines: { select: { id: true } },
      offer: { select: { supplierId: true, price: true, quotedPrice: true, currency: true, exchangeRate: true } },
    },
  });
  if (!items.length) throw new Error("В заказе нет позиций «Готов к отгрузке»");

  const qtyMap = input.quantities ?? {};
  const toShip: { itemId: string; qty: number }[] = [];
  const toCreate: {
    item: (typeof items)[number];
    remainingQty: number;
    nextStatus: OrderStatus;
  }[] = [];

  for (const item of items) {
    const orderedQty = item.quantity;
    const shipQty = Math.max(0, Math.min(orderedQty, Number(qtyMap[item.id] ?? orderedQty)));
    if (shipQty === 0) continue;
    toShip.push({ itemId: item.id, qty: shipQty });
    if (shipQty < orderedQty) {
      const remainingQty = orderedQty - shipQty;
      const stockAfter = Math.max(0, item.product.stock - shipQty);
      const nextStatus: OrderStatus = stockAfter >= remainingQty ? "READY_TO_SHIP" : "AWAITING_SUPPLY";
      toCreate.push({ item, remainingQty, nextStatus });
    }
  }

  if (!toShip.length) throw new Error("Не выбрано позиций для отгрузки");

  // Reduce the quantities of the lines that will actually ship now.
  await prisma.$transaction(
    toShip.map(({ itemId, qty }) => prisma.orderItem.update({ where: { id: itemId }, data: { quantity: qty } }))
  );

  await setLineStatuses(
    input.orderId,
    toShip.map(({ itemId }) => {
      const item = items.find((i) => i.id === itemId)!;
      return { itemId, status: (item.paid ? "DONE" : "SHIPPED_AWAITING_PAYMENT") as OrderStatus };
    }),
    { notify: true }
  );
  // "" -- waits for its УПД (src/lib/order-upd.ts).
  await prisma.orderItem.updateMany({ where: { id: { in: toShip.map((s) => s.itemId) } }, data: { saleRef: "" } });

  // Split off the unshipped remainder into new line(s).
  if (toCreate.length) {
    await prisma.$transaction(async (tx) => {
      for (const { item, remainingQty, nextStatus } of toCreate) {
        const { supplierOrderLines, offer, product: _product, ...base } = item;
        const newItem = await tx.orderItem.create({
          data: {
            orderId: base.orderId,
            productId: base.productId,
            nameSnapshot: base.nameSnapshot,
            priceSnapshot: base.priceSnapshot,
            quantity: remainingQty,
            status: nextStatus,
            paid: base.paid,
            deferred: base.deferred,
            offerId: base.offerId,
            surcharge: base.surcharge,
            bonus: base.bonus,
            deliveryMethod: base.deliveryMethod,
            deliveryDays: base.deliveryDays,
            deliveryDate: base.deliveryDate,
          },
        });

        if (nextStatus === "AWAITING_SUPPLY" && supplierOrderLines.length === 0 && offer?.supplierId) {
          const purchase = await tx.supplierPurchase.create({
            data: { supplierId: offer.supplierId, orderId: base.orderId },
          });
          await tx.supplierOrderLine.create({
            data: {
              productId: base.productId,
              supplierId: offer.supplierId,
              offerId: base.offerId,
              price: offer.price,
              quotedPrice: offer.quotedPrice ?? offer.price,
              currency: offer.currency ?? "RUB",
              exchangeRate: offer.exchangeRate ?? 1,
              quantity: remainingQty,
              orderItemId: newItem.id,
              purchaseId: purchase.id,
            },
          });
        }
      }
    });
  }

  await prisma.order.update({
    where: { id: input.orderId },
    data: { handover: input.kind, handoverAt: new Date(), handoverNote: input.note || null },
  });

  if (input.file) {
    const category = input.documentCategory ?? "WAYBILL";
    const fileUrl = await uploadOrderDocumentFile(input.orderId, category, input.file.content, input.file.name);
    await prisma.orderDocument.create({ data: { orderId: input.orderId, category, fileName: input.file.name, fileUrl } });
  }

  // Paid in advance online: the receipt «Полный расчёт».
  await settleHandedOver(
    input.orderId,
    toShip.map((s) => s.itemId)
  ).catch((e) => console.error("[receipts] handover", e));

  await refreshOrder(prisma, input.orderId);
  return toShip.length;
}
