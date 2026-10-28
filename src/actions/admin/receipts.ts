"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { accessDenied, requireSection } from "@/lib/access-server";
import { OneCError } from "@/lib/onec";
import { supplierVatRate } from "@/lib/onec-purchase";
import { counterpartyRef } from "@/lib/onec-invoice";
import { handOverOrder, receiveGoods, RECEIVABLE } from "@/lib/supplier-receipts";
import { HANDOVER_KINDS, type HandoverKind } from "@/lib/validators/receipts";
import { issueOrderUpd } from "@/lib/order-upd";

export type ReceiptResult = { ok: true; message: string } | { ok: false; error: string };

const MAX_FILE_SIZE = 20 * 1024 * 1024;

function revalidate() {
  revalidatePath("/admin/warehouse", "layout");
  revalidatePath("/admin/crm/supplier-orders");
  revalidatePath("/admin/crm/orders");
  revalidatePath("/shop/orders");
}

async function fileOf(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) return null;
  if (file.size > MAX_FILE_SIZE) throw new Error("Файл больше 20 МБ");
  return { name: file.name, content: Buffer.from(await file.arrayBuffer()) };
}

/** «+ Поступление»: the supplier order lines that may arrive, by supplier. */
export async function getReceivableLines() {
  await requireSection("warehouse", "view");
  const lines = await prisma.supplierOrderLine.findMany({
    where: { status: { in: [...RECEIVABLE] }, receiptId: null, supplierId: { not: null } },
    include: {
      supplier: { select: { id: true, name: true, inn: true } },
      product: { select: { brand: true, name: true, sku: true } },
      purchase: { select: { number: true } },
      orderItem: { select: { order: { select: { orderNumber: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });
  return lines.map((l) => ({
    id: l.id,
    supplierId: l.supplierId!,
    supplierName: l.supplier!.name,
    supplierInn: l.supplier!.inn,
    product: [l.product.brand, l.product.name].filter(Boolean).join(" "),
    sku: l.product.sku,
    quantity: l.quantity,
    price: l.price,
    status: l.status,
    purchaseNumber: l.purchase?.number ?? null,
    orderNumber: l.orderItem?.order.orderNumber ?? null,
  }));
}

/** The supplier's VAT rate as in its latest Поступление in 1С. */
export async function receiptVatRate(supplierId: string): Promise<string | null> {
  await requireSection("warehouse", "view");
  const company = await prisma.company.findUnique({ where: { id: String(supplierId) }, select: { id: true, oneCRef: true, inn: true, name: true } });
  if (!company) return null;
  try {
    return await supplierVatRate(await counterpartyRef(company));
  } catch {
    return null;
  }
}

/** «Провести»: the УПД into 1С, the lines delivered. `data` -- JSON of the card, `file` -- the УПД. */
export async function createReceipt(formData: FormData): Promise<ReceiptResult> {
  const denied = await accessDenied("warehouse");
  if (denied) return denied;
  let input: { supplierId: string; warehouseRef: string; docNumber: string; docDate: string; vatRate: string; note: string; lines: { lineId: string; price: number }[] };
  try {
    input = JSON.parse(String(formData.get("data") ?? ""));
  } catch {
    return { ok: false, error: "Некорректные данные" };
  }
  const docDate = new Date(`${input.docDate}T12:00:00+03:00`);
  if (!input.supplierId) return { ok: false, error: "Выберите поставщика" };
  if (!input.warehouseRef) return { ok: false, error: "Выберите склад" };
  if (!String(input.docNumber ?? "").trim() || Number.isNaN(docDate.getTime())) return { ok: false, error: "Укажите номер и дату УПД" };
  const lines = (input.lines ?? []).map((l) => ({ lineId: String(l.lineId), price: Math.round(Number(l.price)) }));
  if (!lines.length) return { ok: false, error: "Отметьте поступившие позиции" };
  if (lines.some((l) => !(l.price > 0))) return { ok: false, error: "Укажите цену каждой позиции" };
  try {
    const r = await receiveGoods({
      supplierId: String(input.supplierId),
      warehouseRef: String(input.warehouseRef),
      docNumber: String(input.docNumber).trim().slice(0, 60),
      docDate,
      vatRate: String(input.vatRate || "НДС22"),
      lines,
      note: String(input.note ?? "").trim().slice(0, 500),
      file: await fileOf(formData),
    });
    revalidate();
    return {
      ok: true,
      message: `Поступление № ${r.oneCNumber} проведено в 1С${r.orders ? `; заказы клиентов готовы к отгрузке: ${r.orders}` : ""}`,
    };
  } catch (error) {
    console.error("[receipt]", error);
    return { ok: false, error: error instanceof OneCError || error instanceof Error ? error.message : "Поступление не проведено" };
  }
}

/** Выдача: «Выдан» / «Передан в ТК» with its note and the ТН. */
export async function handOver(formData: FormData): Promise<ReceiptResult> {
  const denied = await accessDenied("warehouse");
  if (denied) return denied;
  const kind = String(formData.get("kind") ?? "") as HandoverKind;
  if (!HANDOVER_KINDS.includes(kind)) return { ok: false, error: "Некорректный вид выдачи" };
  try {
    const orderId = String(formData.get("orderId") ?? "");
    const n = await handOverOrder({ orderId, kind, note: String(formData.get("note") ?? "").trim().slice(0, 300), file: await fileOf(formData) });
    revalidate();
    // The УПД follows; if 1С fails, «Сформировать УПД» in the row repeats it.
    try {
      const upd = await issueOrderUpd(orderId);
      revalidate();
      return { ok: true, message: `${kind}: позиций ${n}; УПД № ${upd.number} проведён в 1С и вложен в заказ` };
    } catch (error) {
      console.error("[upd]", error);
      return { ok: true, message: `${kind}: позиций ${n}. УПД не сформирован: ${error instanceof Error ? error.message : "1С не ответила"} — повторите кнопкой «Сформировать УПД»` };
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Не получилось" };
  }
}

/** «Сформировать УПД»: the shipped lines without one. */
export async function issueUpd(orderId: string): Promise<ReceiptResult> {
  const denied = await accessDenied("warehouse");
  if (denied) return denied;
  try {
    const upd = await issueOrderUpd(String(orderId));
    revalidate();
    return { ok: true, message: `УПД № ${upd.number} проведён в 1С и вложен в заказ` };
  } catch (error) {
    console.error("[upd]", error);
    return { ok: false, error: error instanceof Error ? error.message : "УПД не сформирован" };
  }
}
