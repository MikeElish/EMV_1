"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { accessDenied, getMyAccess, requireSection } from "@/lib/access-server";
import { uploadOfferFile, deleteOfferFile } from "@/lib/offer-file-storage";
import { selectOffer, syncSelectedOffer, upsertSupplierOffer } from "@/lib/supplier-offers";
import { priceWithSupplierLogistics } from "@/lib/supplier-pricing";
import { MAX_MONEY_MINOR, parseSupplierCurrency, quotePriceInRub, type SupplierCurrency } from "@/lib/supplier-currency";
import { analyzeOfferRows, sheetRows, writeOfferRows, type OfferImportRow, type OfferRowsAnalysis, type OfferWriteResult } from "@/lib/offer-import";
import {
  analyzePriceReplyText,
  requestedPriceProductIds,
  type PriceReplyCandidate,
} from "@/lib/price-reply-text";

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
  quotedPrice: number;
  currency: SupplierCurrency;
  exchangeRate: number | null;
  logisticsMarkupPercent: number;
  deliveryDays: number | null;
  quality: string | null;
  noOffer: boolean;
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
    quotedPrice: o.quotedPrice ?? o.price,
    currency: parseSupplierCurrency(o.currency) ?? "RUB",
    exchangeRate: o.exchangeRate,
    logisticsMarkupPercent: o.logisticsMarkupPercent,
    deliveryDays: o.deliveryDays,
    quality: o.quality,
    noOffer: o.noOffer,
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
  const quotedPrice = num(formData.get("price"));
  const currency = parseSupplierCurrency(formData.get("currency"));
  const access = await getMyAccess();
  const exchangeRateInput = String(formData.get("exchangeRate") ?? "").trim();
  const exchangeRateRaw = exchangeRateInput ? num(exchangeRateInput) : NaN;
  const markupInput = String(formData.get("logisticsMarkupPercent") ?? "").trim();
  const markupRaw = markupInput ? num(markupInput) : 70;
  const daysRaw = String(formData.get("deliveryDays") ?? "").trim();
  const deliveryDays = daysRaw ? Number(daysRaw) : null;
  const quality = String(formData.get("quality") ?? "").trim() || null;
  const removeFile = formData.get("removeFile") === "1";
  const file = formData.get("file");

  if (!supplierId) return { ok: false, error: "Выберите поставщика" };
  if (!currency) return { ok: false, error: "Выберите валюту предложения" };
  if (!(quotedPrice > 0)) return { ok: false, error: "Укажите цену" };
  const rawPrice = kopecks(quotedPrice);
  if (!Number.isSafeInteger(rawPrice) || rawPrice > MAX_MONEY_MINOR) return { ok: false, error: "Цена слишком велика" };
  if (currency !== "RUB" && access?.role === "OWNER" && exchangeRateInput && (!(exchangeRateRaw > 0) || exchangeRateRaw > 1_000_000)) {
    return { ok: false, error: "Курс должен быть больше нуля" };
  }
  if (currency !== "RUB" && access?.role === "OWNER" && (!Number.isFinite(markupRaw) || markupRaw < 0 || markupRaw > 1000)) {
    return { ok: false, error: "Мультипликатор должен быть от 0 до 1000%" };
  }
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

  const canSetConversion = access?.role === "OWNER";
  const exchangeRate =
    currency === "RUB"
      ? 1
      : canSetConversion
        ? (Number.isFinite(exchangeRateRaw) && exchangeRateRaw > 0 ? exchangeRateRaw : null)
        : existing?.currency === currency ? existing.exchangeRate : null;
  const logisticsMarkupPercent =
    currency === "RUB"
      ? 0
      : canSetConversion
        ? markupRaw
        : existing?.currency === currency ? existing.logisticsMarkupPercent : 70;
  const priceRub = quotePriceInRub(rawPrice, currency, exchangeRate, logisticsMarkupPercent);
  const data = {
    supplierId,
    price: priceRub ?? 0,
    quotedPrice: rawPrice,
    currency,
    exchangeRate,
    logisticsMarkupPercent,
    deliveryDays,
    quality,
    noOffer: false,
    ...(fileData ?? {}),
  };
  if (existing) {
    const moved =
      existing.price !== data.price ||
      existing.quotedPrice !== data.quotedPrice ||
      existing.currency !== data.currency ||
      existing.exchangeRate !== data.exchangeRate ||
      existing.logisticsMarkupPercent !== data.logisticsMarkupPercent ||
      existing.deliveryDays !== deliveryDays;
    await prisma.supplierOffer.update({
      where: { id: existing.id },
      data: { ...data, ...(moved ? { priceUpdatedAt: new Date() } : {}) },
    });
    if (priceRub !== null && !existing.selected && !(await prisma.supplierOffer.count({ where: { productId, selected: true, noOffer: false, price: { gt: 0 } } }))) {
      await selectOffer(prisma, productId, existing.id);
    }
  } else {
    const created = await prisma.supplierOffer.create({ data: { productId, ...data } });
    if (priceRub !== null && !(await prisma.supplierOffer.count({ where: { productId, selected: true, noOffer: false, price: { gt: 0 } } }))) {
      await selectOffer(prisma, productId, created.id);
    }
  }
  if (priceRub === null && existing?.selected) {
    await prisma.supplierOffer.update({ where: { id: existing.id }, data: { selected: false } });
    const fallback = await prisma.supplierOffer.findFirst({
      where: { productId, noOffer: false, price: { gt: 0 } },
      orderBy: [{ priceUpdatedAt: "desc" }, { createdAt: "desc" }],
    });
    if (fallback) await selectOffer(prisma, productId, fallback.id);
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
    const next = await prisma.supplierOffer.findFirst({
      where: { productId: offer.productId, noOffer: false, price: { gt: 0 } },
      orderBy: { price: "asc" },
    });
    if (next) {
      await selectOffer(prisma, offer.productId, next.id);
      await syncSelectedOffer(prisma, offer.productId);
    } else {
      await prisma.product.update({ where: { id: offer.productId }, data: { price: 0 } });
      await prisma.productPricing.updateMany({
        where: { productId: offer.productId },
        data: { purchasePrice: 0, retailPrice: 0, dealerPrice: 0, supplierId: null },
      });
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
  const offer = await prisma.supplierOffer.findUnique({
    where: { id: offerId },
    include: { supplier: { select: { supplierProfile: { select: { logisticsMarkupPercent: true } } } } },
  });
  if (!offer || offer.noOffer || offer.price <= 0 || !offer.quotedPrice) return { ok: false, error: "У поставщика нет цены в рублях. Проверьте курс валюты в предложении" };
  const currency = parseSupplierCurrency(offer.currency) ?? "RUB";
  const quotedPrice = offer.quotedPrice ?? offer.price;
  const price = currency === "RUB"
    ? priceWithSupplierLogistics(offer.price, offer.supplier?.supplierProfile?.logisticsMarkupPercent ?? 0)
    : offer.price;
  await prisma.supplierOrderLine.create({
    data: {
      productId: offer.productId,
      supplierId: offer.supplierId,
      offerId: offer.id,
      price,
      quotedPrice,
      currency,
      exchangeRate: offer.exchangeRate,
      logisticsMarkupPercent: offer.logisticsMarkupPercent,
      quantity,
      deliveryDays: offer.deliveryDays,
      quality: offer.quality,
      warehouse: offer.warehouse,
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
  currency?: string;
  exchangeRate?: number | null;
  logisticsMarkupPercent?: number;
}): Promise<({ ok: true } & OfferWriteResult) | { ok: false; error: string }> {
  const denied = await accessDenied("crm.price-check");
  if (denied) return denied;
  const currency = parseSupplierCurrency(input.currency ?? "RUB");
  if (!currency) return { ok: false, error: "Выберите валюту предложения" };
  if (!Array.isArray(input.rows) || input.rows.length > 20000) return { ok: false, error: "Некорректный список предложений" };
  if (input.rows.some((row) => !row || !Number.isSafeInteger(row.price) || row.price <= 0 || row.price > MAX_MONEY_MINOR)) {
    return { ok: false, error: "В списке есть некорректная или слишком высокая цена" };
  }
  const fileCurrencies = new Set(input.rows.flatMap((row) => row.currency ? [row.currency] : []));
  if (fileCurrencies.size > 1) return { ok: false, error: "Разделите файл на отдельные файлы по валюте" };
  if (fileCurrencies.size === 1 && !fileCurrencies.has(currency)) {
    return { ok: false, error: "Выбранная валюта не совпадает с валютой файла" };
  }
  const me = await getMyAccess();
  const requestedRate = input.exchangeRate == null ? null : Number(input.exchangeRate);
  const exchangeRate = currency === "RUB" ? 1 : me?.role === "OWNER" ? requestedRate : null;
  const requestedMarkup = input.logisticsMarkupPercent == null ? null : Number(input.logisticsMarkupPercent);
  const logisticsMarkupPercent = currency === "RUB" ? 0 : me?.role === "OWNER" ? requestedMarkup ?? 70 : 70;
  if (currency !== "RUB" && me?.role === "OWNER" && (
    exchangeRate === null || !Number.isFinite(exchangeRate) || exchangeRate <= 0 || exchangeRate > 1_000_000
  )) {
    return { ok: false, error: "Укажите корректный курс валюты" };
  }
  if (currency !== "RUB" && me?.role !== "OWNER" && (requestedRate !== null || (requestedMarkup !== null && requestedMarkup !== 70))) {
    return { ok: false, error: "Курс и мультипликатор может задать только владелец" };
  }
  if (currency !== "RUB" && (!Number.isFinite(logisticsMarkupPercent) || logisticsMarkupPercent < 0 || logisticsMarkupPercent > 1000)) {
    return { ok: false, error: "Мультипликатор должен быть от 0 до 1000%" };
  }
  if (currency !== "RUB" && exchangeRate !== null && input.rows.some((row) => {
    const rowCurrency = row.currency ?? currency;
    return rowCurrency === currency && quotePriceInRub(row.price, currency, exchangeRate, logisticsMarkupPercent) === null;
  })) {
    return { ok: false, error: "Рублёвая цена превышает допустимое значение" };
  }
  const supplier = await prisma.company.findUnique({ where: { id: input.supplierId }, select: { id: true } });
  if (!supplier) return { ok: false, error: "Поставщик не найден" };
  const result = await writeOfferRows(input.supplierId, input.rows, input.createMissing, {
    currency,
    exchangeRate,
    logisticsMarkupPercent,
  });
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
  answerBody: string | null;
  answerReviewedAt: string | null;
  replyCandidates: PriceReplyCandidate[];
  summarySentAt: string | null;
  lines: number;
  requestedLines: {
    productId: string;
    sku: string;
    name: string;
    status: "PENDING" | "OFFER" | "NO_OFFER";
  }[];
};

/** The latest requests (src/lib/price-requests.ts), newest first. */
export async function listPriceRequests(): Promise<PriceRequestView[]> {
  await requireSection("crm.price-check", "view");
  const rows = await prisma.priceRequest.findMany({
    orderBy: { sentAt: "desc" },
    take: 300,
    include: {
      order: { select: { orderNumber: true } },
      supplier: { select: { name: true } },
      lines: { include: { product: { select: { id: true, sku: true, name: true } } } },
    },
  });
  const productIds = [...new Set(rows.flatMap((row) => requestedPriceProductIds(row.items)))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, sku: true, name: true },
  });
  const productsById = new Map(products.map((product) => [product.id, product]));
  const iso = (d: Date | null) => d?.toISOString() ?? null;
  return rows.map((r) => {
    const answerBody = r.answerReviewedAt ? null : r.answerBody;
    const requestedProducts = requestedPriceProductIds(r.items)
      .map((id) => productsById.get(id))
      .filter((product): product is (typeof products)[number] => !!product);
    return {
      id: r.id,
      orderNumber: r.order.orderNumber,
      supplier: r.supplier.name,
      email: r.email,
      sentAt: r.sentAt.toISOString(),
      remindedAt: iso(r.remindedAt),
      answeredAt: iso(r.answeredAt),
      answerNote: r.answerNote,
      answerBody,
      answerReviewedAt: iso(r.answerReviewedAt),
      replyCandidates: answerBody
        ? analyzePriceReplyText(answerBody, requestedProducts)
        : [],
      summarySentAt: iso(r.summarySentAt),
      lines: Array.isArray(r.items) ? r.items.length : 0,
      requestedLines: r.lines.map((line) => ({
        productId: line.product.id,
        sku: line.product.sku,
        name: line.product.name,
        status: line.status,
      })),
    };
  });
}

/** Applies text-reply price suggestions only after an administrator reviews them. */
export async function applyPriceReplyReview(
  requestId: string,
  lines: { productId: string; priceRub: string; deliveryDays: string }[],
): Promise<ActionResult> {
  const denied = await accessDenied("crm.price-check");
  if (denied) return denied;
  if (!Array.isArray(lines) || lines.length > 200) {
    return { ok: false, error: "Некорректный список предложений" };
  }

  const request = await prisma.priceRequest.findUnique({
    where: { id: requestId },
    select: { id: true, supplierId: true, items: true, answerBody: true, answerReviewedAt: true },
  });
  if (!request?.answerBody) return { ok: false, error: "Текст ответа не найден" };
  if (request.answerReviewedAt) return { ok: false, error: "Этот ответ уже проверен" };

  const productIds = requestedPriceProductIds(request.items);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, sku: true, name: true },
  });
  const candidateIds = new Set(
    analyzePriceReplyText(request.answerBody, products).map((candidate) => candidate.productId),
  );
  const seen = new Set<string>();
  const validated: { productId: string; price: number; deliveryDays: number | null }[] = [];

  for (const line of lines) {
    if (
      !line ||
      typeof line.productId !== "string" ||
      !candidateIds.has(line.productId) ||
      seen.has(line.productId)
    ) {
      return { ok: false, error: "В ответе есть неподтверждённая или повторная позиция" };
    }
    const priceRub = num(line.priceRub);
    if (!(priceRub > 0) || priceRub > 100_000_000) {
      return { ok: false, error: "Проверьте цену: она должна быть больше нуля" };
    }
    const daysRaw = String(line.deliveryDays ?? "").trim();
    const deliveryDays = daysRaw ? Number(daysRaw) : null;
    if (deliveryDays !== null && (!Number.isInteger(deliveryDays) || deliveryDays < 0 || deliveryDays > 365)) {
      return { ok: false, error: "Срок поставки — целое число дней от 0 до 365" };
    }
    seen.add(line.productId);
    validated.push({
      productId: line.productId,
      price: kopecks(priceRub),
      deliveryDays,
    });
  }

  await prisma.$transaction(async (tx) => {
    for (const line of validated) {
      await upsertSupplierOffer(tx, line.productId, {
        supplierId: request.supplierId,
        price: line.price,
        quotedPrice: line.price,
        currency: "RUB",
        exchangeRate: 1,
        logisticsMarkupPercent: 0,
        deliveryDays: line.deliveryDays,
      });
      await syncSelectedOffer(tx, line.productId);
    }
    if (validated.length) {
      await tx.priceRequestLine.updateMany({
        where: { requestId: request.id, productId: { in: validated.map((line) => line.productId) } },
        data: { status: "OFFER" },
      });
    }
    await tx.priceRequest.update({
      where: { id: request.id },
      data: {
        answerReviewedAt: new Date(),
        answerNote: `${validated.length ? `Внесено предложений: ${validated.length}` : "Текст ответа проверен; цены не внесены"}.`,
      },
    });
  });
  revalidate();
  return { ok: true };
}
