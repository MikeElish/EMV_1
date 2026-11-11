"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { accessDenied } from "@/lib/access-server";
import { prisma } from "@/lib/prisma";
import { sendSiteMail } from "@/lib/mailer";
import { loadSupplierQuote, type SupplierQuoteRow } from "@/lib/supplier-quote";
import {
  MAX_MONEY_MINOR,
  parseSupplierCurrency,
  quotePriceInRub,
  type SupplierCurrency,
} from "@/lib/supplier-currency";
import { markSupplierOfferNoOffer, syncSelectedOffer, upsertSupplierOffer } from "@/lib/supplier-offers";

type QuoteEntry = {
  productId: string;
  priceRub: string;
  currency: SupplierCurrency;
  noOffer: boolean;
  quality: string;
  warehouse: string;
  deliveryDays: string;
};

type QuoteActionResult =
  | { ok: true; notificationError?: string }
  | { ok: false; error: string };
type QuoteImportResult =
  | { ok: true; entries: QuoteEntry[] }
  | { ok: false; error: string };
type QuoteWorkbookResult = QuoteImportResult;

const MAX_EXCEL_BYTES = 5 * 1024 * 1024;
const MAX_EXCEL_ROWS = 1000;
function parsePrice(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(normalized)) return null;
  const rubles = Number(normalized);
  if (!Number.isFinite(rubles) || rubles <= 0) return null;
  const kopecks = Math.round(rubles * 100);
  return kopecks <= MAX_MONEY_MINOR ? kopecks : null;
}

function validateEntries(rows: SupplierQuoteRow[], entries: QuoteEntry[]) {
  if (!Array.isArray(entries) || entries.length !== rows.length) return { error: "Обновите страницу запроса и повторите отправку" };
  const allowed = new Set(rows.map((row) => row.productId));
  const seen = new Set<string>();
  const valid: (QuoteEntry & { price: number | null; days: number | null })[] = [];

  for (const entry of entries) {
    if (!entry || !allowed.has(entry.productId) || seen.has(entry.productId)) {
      return { error: "Состав запроса изменился — обновите страницу" };
    }
    seen.add(entry.productId);
    if ([entry.quality, entry.warehouse, entry.priceRub, entry.deliveryDays, entry.currency].some((value) => typeof value !== "string") ||
        typeof entry.noOffer !== "boolean") {
      return { error: "Проверьте заполненные поля" };
    }
    const currency = parseSupplierCurrency(entry.currency);
    if (!currency) return { error: "Выберите одну из доступных валют" };
    const noOffer = entry.noOffer || !entry.priceRub.trim();
    const price = noOffer ? null : parsePrice(entry.priceRub);
    if (!noOffer && price === null) return { error: `Укажите корректную цену для артикула ${rows.find((row) => row.productId === entry.productId)?.sku}` };
    const daysText = entry.deliveryDays.trim();
    const days = daysText ? Number(daysText) : null;
    if (days !== null && (!Number.isInteger(days) || days < 0 || days > 365)) {
      return { error: "Срок поставки должен быть целым числом от 0 до 365" };
    }
    if (entry.quality.length > 100 || entry.warehouse.length > 120) {
      return { error: "Слишком длинное значение качества или склада" };
    }
    valid.push({ ...entry, currency, noOffer, price, days });
  }
  return { valid };
}

export async function submitSupplierProposal(token: string, entries: QuoteEntry[]): Promise<QuoteActionResult> {
  const quote = await loadSupplierQuote(token);
  if (!quote || !quote.rows.length) return { ok: false, error: "Ссылка на запрос больше не активна" };
  const checked = validateEntries(quote.rows, entries);
  if (!checked.valid) return { ok: false, error: checked.error };

  const offered = checked.valid.filter((entry) => !entry.noOffer && entry.price !== null);
  const notOffered = checked.valid.filter((entry) => entry.noOffer);
  await prisma.$transaction(async (tx) => {
    for (const entry of offered) {
      const current = quote.rows.find((row) => row.productId === entry.productId);
      const sameCurrency = current?.currency === entry.currency;
      const exchangeRate = entry.currency === "RUB" ? 1 : sameCurrency ? current.exchangeRate : null;
      const logisticsMarkupPercent = entry.currency === "RUB" ? 0 : sameCurrency ? current.logisticsMarkupPercent : 70;
      const priceRub =
        quotePriceInRub(entry.price!, entry.currency, exchangeRate, logisticsMarkupPercent) ?? 0;
      await upsertSupplierOffer(
        tx,
        entry.productId,
        {
          supplierId: quote.supplierId,
          price: priceRub,
          quotedPrice: entry.price!,
          currency: entry.currency,
          exchangeRate,
          logisticsMarkupPercent,
          deliveryDays: entry.days,
          quality: entry.quality.trim() || null,
          warehouse: entry.warehouse.trim() || null,
        },
        { selectIfNone: priceRub > 0 }
      );
      if (priceRub > 0) await syncSelectedOffer(tx, entry.productId);
    }
    for (const entry of notOffered) {
      await markSupplierOfferNoOffer(tx, entry.productId, quote.supplierId);
    }
    if (offered.length) {
      await tx.priceRequestLine.updateMany({
        where: { requestId: quote.requestId, productId: { in: offered.map((entry) => entry.productId) } },
        data: { status: "OFFER" },
      });
    }
    if (notOffered.length) {
      await tx.priceRequestLine.updateMany({
        where: { requestId: quote.requestId, productId: { in: notOffered.map((entry) => entry.productId) } },
        data: { status: "NO_OFFER" },
      });
    }
    await tx.priceRequest.update({
      where: { id: quote.requestId },
      data: {
        answeredAt: new Date(),
        answerNote: `Через страницу внесено предложений: ${offered.length}; нет предложения: ${notOffered.length}.`,
        answerBody: "Предложение отправлено через временную страницу поставщика.",
      },
    });
  });

  let notificationError: string | undefined;
  if (!quote.managerNotifiedAt) {
    if (!quote.managerEmail) {
      notificationError = "Предложение сохранено, но у закреплённого менеджера не указан e-mail.";
    } else {
      try {
        await sendSiteMail({
          to: quote.managerEmail,
          subject: `Поставщик предоставил предложение — заказ ${quote.orderNumber}`,
          text: `Поставщик ${quote.supplierName} предоставил предложение по запросу ${quote.orderNumber}.`,
        });
        await prisma.priceRequest.update({ where: { id: quote.requestId }, data: { managerNotifiedAt: new Date() } });
      } catch (error) {
        console.error("[supplier-proposal] manager notification", quote.requestId, error);
        notificationError = "Предложение сохранено, но уведомление менеджеру отправить не удалось.";
      }
    }
  }

  revalidatePath("/admin/crm/price-check");
  revalidatePath("/admin/crm/supplier-orders");
  revalidatePath("/admin/crm/products");
  revalidatePath("/shop", "layout");
  return { ok: true, ...(notificationError ? { notificationError } : {}) };
}

function cellText(value: ExcelJS.CellValue): string {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (value && typeof value === "object" && "text" in value && typeof value.text === "string") return value.text.trim();
  return "";
}

async function parseQuoteWorkbook(file: File, rows: SupplierQuoteRow[]): Promise<QuoteWorkbookResult> {
  if (!file.size || file.size > MAX_EXCEL_BYTES) return { ok: false, error: "Excel-файл должен быть не больше 5 МБ" };
  if (!file.name.toLowerCase().endsWith(".xlsx")) return { ok: false, error: "Загрузите файл .xlsx" };
  const workbook = new ExcelJS.Workbook();
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    await workbook.xlsx.load(bytes as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  } catch (error) {
    console.error("[supplier-proposal] read Excel", error);
    return { ok: false, error: "Не удалось прочитать Excel-файл" };
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) return { ok: false, error: "В Excel-файле нет листа с предложением" };
  if (sheet.rowCount > MAX_EXCEL_ROWS + 1 || sheet.columnCount > 20) {
    return { ok: false, error: `В Excel-файле допускается не более ${MAX_EXCEL_ROWS} строк с предложениями` };
  }
  const header = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, column) => header.set(cellText(cell.value).toLocaleLowerCase("ru-RU"), column));
  const skuColumn = header.get("артикул");
  const priceColumn = header.get("цена");
  const qualityColumn = header.get("качество");
  const warehouseColumn = header.get("склад");
  const daysColumn = header.get("срок поставки (дней)") ?? header.get("срок поставки");
  const statusColumn = header.get("статус предложения");
  const currencyColumn = header.get("валюта");
  if (!skuColumn || !priceColumn || !qualityColumn || !warehouseColumn || !daysColumn) {
    return { ok: false, error: "В файле отсутствуют столбцы Артикул, Цена, Качество, Склад или Срок поставки" };
  }

  const bySku = new Map(rows.map((row) => [row.sku, row]));
  const imported = new Map<string, QuoteEntry>();
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const sku = cellText(row.getCell(skuColumn).value);
    if (!sku) continue;
    const item = bySku.get(sku);
    if (!item) return { ok: false, error: `Артикул ${sku} не входит в этот запрос` };
    if (imported.has(item.productId)) return { ok: false, error: `Артикул ${sku} повторяется в файле` };
    const priceRub = cellText(row.getCell(priceColumn).value);
    const currencyText = currencyColumn ? cellText(row.getCell(currencyColumn).value).toUpperCase() : "RUB";
    const currency = currencyText ? parseSupplierCurrency(currencyText) : "RUB";
    if (!currency) return { ok: false, error: `Проверьте валюту в строке ${rowNumber}` };
    const deliveryDays = cellText(row.getCell(daysColumn).value);
    const noOffer = Boolean(
      (statusColumn && cellText(row.getCell(statusColumn).value).toLocaleLowerCase("ru-RU") === "нет предложения") ||
      !priceRub
    );
    if (!noOffer && parsePrice(priceRub) === null) return { ok: false, error: `Проверьте цену в строке ${rowNumber}` };
    if (deliveryDays && (!/^\d+$/.test(deliveryDays) || Number(deliveryDays) > 365)) {
      return { ok: false, error: `Проверьте срок поставки в строке ${rowNumber}` };
    }
    imported.set(item.productId, {
      productId: item.productId,
      priceRub,
      currency,
      noOffer,
      quality: cellText(row.getCell(qualityColumn).value),
      warehouse: cellText(row.getCell(warehouseColumn).value),
      deliveryDays,
    });
  }
  return { ok: true, entries: [...imported.values()] };
}

export async function importSupplierProposal(token: string, formData: FormData): Promise<QuoteImportResult> {
  const quote = await loadSupplierQuote(token);
  if (!quote || !quote.rows.length) return { ok: false as const, error: "Ссылка на запрос больше не активна" };
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false as const, error: "Выберите Excel-файл" };
  const result = await parseQuoteWorkbook(file, quote.rows);
  return result;
}

export async function importSupplierProposalPreview(orderNumber: string, formData: FormData): Promise<QuoteImportResult> {
  const denied = await accessDenied("crm.supplier-orders", "view");
  if (denied) return { ok: false as const, error: denied.error };
  const normalized = String(orderNumber).trim();
  if (!normalized || normalized.length > 100) return { ok: false as const, error: "Укажите номер заказа" };
  const order = await prisma.order.findUnique({
    where: { orderNumber: normalized },
    select: {
      items: {
        where: { cancelled: false },
        select: { productId: true, quantity: true, product: { select: { sku: true, name: true } } },
      },
    },
  });
  if (!order) return { ok: false as const, error: "Заказ не найден" };
  const rows: SupplierQuoteRow[] = order.items.map((item) => ({
    productId: item.productId,
    sku: item.product.sku,
    name: item.product.name,
    quantity: item.quantity,
    price: null,
    currency: "RUB",
    exchangeRate: 1,
    logisticsMarkupPercent: 0,
    noOffer: false,
    quality: "",
    warehouse: "",
    deliveryDays: "",
  }));
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false as const, error: "Выберите Excel-файл" };
  const result = await parseQuoteWorkbook(file, rows);
  return result;
}
