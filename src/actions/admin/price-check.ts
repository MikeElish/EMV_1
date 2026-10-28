"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { accessDenied, requireSection } from "@/lib/access-server";
import { uploadOfferFile, deleteOfferFile } from "@/lib/offer-file-storage";
import { selectOffer, syncSelectedOffer } from "@/lib/supplier-offers";
import { sendPriceRequests } from "@/lib/price-requests";
import { analyzeOfferRows, sheetRows, writeOfferRows, type OfferImportRow, type OfferRowsAnalysis, type OfferWriteResult } from "@/lib/offer-import";

export type ActionResult = { ok: true } | { ok: false; error: string };

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const kopecks = (rub: number) => Math.round(rub * 100);
const num = (v: unknown) => {
  const n = Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

function revalidate() {
  revalidatePath("/admin/crm/price-check");
  revalidatePath("/admin/crm/products");
  revalidatePath("/admin/crm/supplier-orders");
  revalidatePath("/shop", "layout");
}

export type OfferView = {
  id: string;
  supplierId: string | null;
  supplierName: string | null;
  price: number;
  deliveryDays: number | null;
  quality: string | null;
  selected: boolean;
  fileName: string | null;
  fileUrl: string | null;
  priceUpdatedAt: Date;
};

/** All supplier offers of a product, cheapest first. */
export async function listProductOffers(productId: string): Promise<OfferView[]> {
  await requireSection("crm.price-check", "view");
  const offers = await prisma.supplierOffer.findMany({
    where: { productId },
    include: { supplier: { select: { name: true } } },
    orderBy: [{ price: "asc" }, { priceUpdatedAt: "desc" }],
  });
  return offers.map((o) => ({
    id: o.id,
    supplierId: o.supplierId,
    supplierName: o.supplier?.name ?? null,
    price: o.price,
    deliveryDays: o.deliveryDays,
    quality: o.quality,
    selected: o.selected,
    fileName: o.fileName,
    fileUrl: o.fileUrl,
    priceUpdatedAt: o.priceUpdatedAt,
  }));
}

/**
 * Creates (no id) or edits an offer. «Дата обновления» moves when the price
 * or the delivery time change. The selected offer drags the site prices along.
 */
export async function saveOffer(formData: FormData): Promise<ActionResult> {
  const denied = await accessDenied("crm.price-check");
  if (denied) return denied;
  const id = String(formData.get("id") ?? "") || null;
  const productId = String(formData.get("productId") ?? "");
  const supplierId = String(formData.get("supplierId") ?? "") || null;
  const price = num(formData.get("price"));
  const daysRaw = String(formData.get("deliveryDays") ?? "").trim();
  const deliveryDays = daysRaw ? Number(daysRaw) : null;
  const quality = String(formData.get("quality") ?? "").trim() || null;
  const removeFile = formData.get("removeFile") === "1";
  const file = formData.get("file");

  if (!supplierId) return { ok: false, error: "Выберите поставщика" };
  if (!(price > 0)) return { ok: false, error: "Укажите цену" };
  if (deliveryDays !== null && (!Number.isInteger(deliveryDays) || deliveryDays < 0 || deliveryDays > 365)) {
    return { ok: false, error: "Срок поставки — целое число дней" };
  }
  if (file instanceof File && file.size > MAX_FILE_SIZE) return { ok: false, error: "Файл больше 20 МБ" };
  const [product, supplier] = await Promise.all([
    prisma.product.findUnique({ where: { id: productId }, select: { id: true } }),
    prisma.company.findUnique({ where: { id: supplierId }, select: { id: true } }),
  ]);
  if (!product) return { ok: false, error: "Товар не найден" };
  if (!supplier) return { ok: false, error: "Поставщик не найден" };

  const existing = id ? await prisma.supplierOffer.findUnique({ where: { id } }) : null;
  if (id && (!existing || existing.productId !== productId)) return { ok: false, error: "Предложение не найдено" };

  let fileData: { fileName: string | null; fileUrl: string | null } | undefined;
  if (file instanceof File && file.size > 0) {
    fileData = { fileName: file.name, fileUrl: await uploadOfferFile(productId, Buffer.from(await file.arrayBuffer()), file.name) };
    await deleteOfferFile(existing?.fileUrl);
  } else if (removeFile) {
    fileData = { fileName: null, fileUrl: null };
    await deleteOfferFile(existing?.fileUrl);
  }

  const data = { supplierId, price: kopecks(price), deliveryDays, quality, ...(fileData ?? {}) };
  if (existing) {
    const moved = existing.price !== data.price || existing.deliveryDays !== deliveryDays;
    await prisma.supplierOffer.update({
      where: { id: existing.id },
      data: { ...data, ...(moved ? { priceUpdatedAt: new Date() } : {}) },
    });
  } else {
    const created = await prisma.supplierOffer.create({ data: { productId, ...data } });
    if (!(await prisma.supplierOffer.count({ where: { productId, selected: true } }))) {
      await selectOffer(prisma, productId, created.id);
    }
  }
  await syncSelectedOffer(prisma, productId);
  revalidate();
  return { ok: true };
}

export async function deleteOffer(id: string): Promise<ActionResult> {
  const denied = await accessDenied("crm.price-check");
  if (denied) return denied;
  const offer = await prisma.supplierOffer.findUnique({ where: { id } });
  if (!offer) return { ok: false, error: "Предложение не найдено" };
  await prisma.supplierOffer.delete({ where: { id } });
  await deleteOfferFile(offer.fileUrl);
  if (offer.selected) {
    // The cheapest remaining offer takes over the site price.
    const next = await prisma.supplierOffer.findFirst({ where: { productId: offer.productId }, orderBy: { price: "asc" } });
    if (next) {
      await selectOffer(prisma, offer.productId, next.id);
      await syncSelectedOffer(prisma, offer.productId);
    }
  }
  revalidate();
  return { ok: true };
}

/** «Заказать»: the offer goes to CRM → Заказ поставщику. */
export async function orderFromOffer(offerId: string, quantity: number): Promise<ActionResult> {
  const denied = await accessDenied("crm.price-check");
  if (denied) return denied;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000) return { ok: false, error: "Укажите количество" };
  const offer = await prisma.supplierOffer.findUnique({ where: { id: offerId } });
  if (!offer) return { ok: false, error: "Предложение не найдено" };
  await prisma.supplierOrderLine.create({
    data: {
      productId: offer.productId,
      supplierId: offer.supplierId,
      offerId: offer.id,
      price: offer.price,
      quantity,
      deliveryDays: offer.deliveryDays,
      quality: offer.quality,
    },
  });
  revalidatePath("/admin/crm/supplier-orders");
  return { ok: true };
}

// ---- Excel upload ------------------------------------------------------------

export type { OfferImportRow };

export type OfferImportAnalysis = ({ ok: true } & OfferRowsAnalysis) | { ok: false; error: string };

/**
 * Reads a supplier price file -- columns Бренд, Наименование, Артикул, Количество,
 * Цена, Итого, Срок поставки, Качество (first row = headers) -- and matches it with the
 * catalogue. Writes nothing.
 */
export async function analyzeOfferImport(formData: FormData): Promise<OfferImportAnalysis> {
  await requireSection("crm.price-check", "edit");
  const supplierId = String(formData.get("supplierId") ?? "");
  const file = formData.get("file");
  if (!supplierId) return { ok: false, error: "Выберите поставщика" };
  if (!(file instanceof File) || !file.size) return { ok: false, error: "Выберите файл" };
  if (file.size > MAX_FILE_SIZE) return { ok: false, error: "Файл больше 20 МБ" };

  let raw: unknown[][];
  try {
    raw = sheetRows(Buffer.from(await file.arrayBuffer()), file.name);
  } catch (e) {
    return { ok: false, error: `Не удалось разобрать файл: ${(e as Error).message}` };
  }
  return { ok: true, ...(await analyzeOfferRows(raw, supplierId)) };
}

/** Writes the analysed file (src/lib/offer-import.ts → writeOfferRows). */
export async function commitOfferImport(input: {
  supplierId: string;
  rows: OfferImportRow[];
  createMissing: boolean;
}): Promise<({ ok: true } & OfferWriteResult) | { ok: false; error: string }> {
  const denied = await accessDenied("crm.price-check");
  if (denied) return denied;
  const supplier = await prisma.company.findUnique({ where: { id: input.supplierId }, select: { id: true } });
  if (!supplier) return { ok: false, error: "Поставщик не найден" };
  const result = await writeOfferRows(input.supplierId, input.rows, input.createMissing);
  revalidate();
  return { ok: true, ...result };
}

export async function deleteSupplierOrderLine(id: string): Promise<ActionResult> {
  const denied = await accessDenied("crm.supplier-orders");
  if (denied) return denied;
  await prisma.supplierOrderLine.deleteMany({ where: { id } });
  revalidatePath("/admin/crm/supplier-orders");
  return { ok: true };
}

// ---- Запросы КП по почте ----------------------------------------------------------

export type PriceRequestView = {
  id: string;
  orderNumber: string;
  supplier: string;
  email: string;
  sentAt: string;
  remindedAt: string | null;
  answeredAt: string | null;
  answerNote: string | null;
  summarySentAt: string | null;
  lines: number;
};

/** The latest requests (src/lib/price-requests.ts), newest first. */
export async function listPriceRequests(): Promise<PriceRequestView[]> {
  await requireSection("crm.price-check", "view");
  const rows = await prisma.priceRequest.findMany({
    orderBy: { sentAt: "desc" },
    take: 300,
    include: { order: { select: { orderNumber: true } }, supplier: { select: { name: true } } },
  });
  const iso = (d: Date | null) => d?.toISOString() ?? null;
  return rows.map((r) => ({
    id: r.id,
    orderNumber: r.order.orderNumber,
    supplier: r.supplier.name,
    email: r.email,
    sentAt: r.sentAt.toISOString(),
    remindedAt: iso(r.remindedAt),
    answeredAt: iso(r.answeredAt),
    answerNote: r.answerNote,
    summarySentAt: iso(r.summarySentAt),
    lines: Array.isArray(r.items) ? r.items.length : 0,
  }));
}

/** «Запросить КП» by an order number: suppliers not asked yet for its lines in «Проверка заказа». */
export async function requestPricesForOrder(orderNumber: string): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const denied = await accessDenied("crm.price-check");
  if (denied) return denied;
  const order = await prisma.order.findFirst({ where: { orderNumber: String(orderNumber).trim() }, select: { id: true } });
  if (!order) return { ok: false, error: "Заказ не найден" };
  try {
    const r = await sendPriceRequests(order.id);
    const parts = [
      r.sent.length ? `Отправлено: ${r.sent.join(", ")}` : "Новых запросов нет",
      r.already.length && `уже запрошены: ${r.already.join(", ")}`,
      r.noContact.length && `нет e-mail в карточке: ${r.noContact.join(", ")}`,
      r.noSupplier.length && `нет поставщика у артикулов: ${r.noSupplier.join(", ")}`,
    ];
    return { ok: true, message: parts.filter(Boolean).join("; ") };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Письма не отправлены" };
  }
}
