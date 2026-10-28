import "server-only";
import { parse } from "csv-parse/sync";
import { read, utils } from "xlsx";
import { prisma } from "@/lib/prisma";
import { findCanonicalBrand } from "@/lib/normalize-brand";
import { buildProductSlug } from "@/lib/slug";
import { syncSelectedOffer, upsertSupplierOffer } from "@/lib/supplier-offers";

// A supplier's price table -- Проценка → «Загрузить из Excel» and the
// replies to the price requests by mail (src/lib/price-requests.ts) -- read,
// matched with the catalogue and written as the supplier's offers.

const kopecks = (rub: number) => Math.round(rub * 100);
const num = (v: unknown) => {
  const n = Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};
/** «3», «3 дн.», «2-3 дня» → days (the longer end of a range). */
function parseDays(v: unknown): number | null {
  const nums = String(v ?? "").match(/\d+/g);
  return nums ? Math.max(...nums.map(Number)) : null;
}
const skuKey = (s: string) => s.toUpperCase().replace(/[\s\-_.\/\\]/g, "");

export type OfferImportRow = {
  row: number;
  brand: string;
  name: string;
  sku: string;
  price: number; // kopecks
  deliveryDays: number | null;
  /** As the site names it («Оригинал», «Аналог (OEM)», «Аналог»); null: not given -- the offer keeps its own. */
  quality: string | null;
  /** «Артикул аналога» of the request sheet, when the supplier offers one. */
  analog: string | null;
  productId: string | null;
  productName: string | null;
  /** update: the supplier already has an offer; add: new offer; missing: no such article. */
  kind: "update" | "add" | "missing";
  oldPrice: number | null;
};

export type OfferRowsAnalysis = { rows: OfferImportRow[]; errors: { row: number; message: string }[]; duplicates: string[] };

/** The first sheet of an xlsx/xls/ods, or a CSV, as rows of cells. */
export function sheetRows(buffer: Buffer, fileName: string): unknown[][] {
  if (/\.(xlsx|xls|ods)$/i.test(fileName)) {
    const workbook = read(buffer, { type: "buffer" });
    return utils.sheet_to_json<unknown[]>(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: "" });
  }
  return parse(buffer.toString("utf8"), { columns: false, skip_empty_lines: true, trim: true });
}

const IMPORT_COLUMNS: RegExp[] = [
  /^бренд|^производител/,
  /^наименование/,
  /^артикул(?!.*аналог)/,
  /^кол/,
  /^цена/,
  /^итого|^всего|^сумма/,
  /^срок/,
  /^качеств/,
  /аналог/,
];

/** «Качество» of a supplier's file (the request sheet offers Original / OEM / Analog) → the site's words. */
function parseQuality(raw: unknown): string | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  const v = value.toLowerCase();
  if (/^(original|orig|оригинал)/.test(v)) return "Оригинал";
  if (/oem|оем/.test(v)) return "Аналог (OEM)";
  if (/^(analog|аналог)/.test(v)) return "Аналог";
  if (/б\/у|used/.test(v)) return "Б/у";
  return value.slice(0, 40);
}

/**
 * Where Бренд, Наименование, Артикул, Количество, Цена, Итого, Срок поставки,
 * Качество (and Артикул аналога) are: found by the header row, or in this
 * order when the headers aren't recognised.
 */
function columnPositions(header: unknown[]): number[] {
  const names = header.map((h) => String(h ?? "").trim().toLowerCase());
  const found = IMPORT_COLUMNS.map((re) => names.findIndex((n) => re.test(n)));
  return found[2] >= 0 && (found[4] >= 0 || found[5] >= 0) ? found : IMPORT_COLUMNS.map((_, i) => i);
}

/**
 * Reads the table (first row = headers) and matches it with the catalogue
 * by article (and brand, when several brands share it). Writes nothing.
 * Lines without a price -- the supplier has none -- are left out silently
 * when `skipUnpriced`.
 */
export async function analyzeOfferRows(raw: unknown[][], supplierId: string, skipUnpriced = false): Promise<OfferRowsAnalysis> {
  const errors: { row: number; message: string }[] = [];
  const parsed: Omit<OfferImportRow, "productId" | "productName" | "kind" | "oldPrice">[] = [];
  const at = columnPositions(raw[0] ?? []);
  raw.slice(1).forEach((cells, i) => {
    const row = i + 2;
    if (cells.every((c) => c === "" || c == null)) return;
    const [brandRaw, nameRaw, skuRaw, qtyRaw, priceRaw, totalRaw, daysRaw, qualityRaw, analogRaw] = at.map((p) => (p < 0 ? "" : cells[p]));
    const sku = String(skuRaw ?? "").trim();
    const name = String(nameRaw ?? "").trim();
    const brand = String(brandRaw ?? "").trim();
    // «Цена»; when the file has only «Итого», that one -- per piece when «Количество» is given.
    const qty = num(qtyRaw);
    const price = String(priceRaw ?? "").trim() ? num(priceRaw) : qty > 0 ? num(totalRaw) / qty : num(totalRaw);
    if (!sku) return errors.push({ row, message: "Нет артикула" });
    if (!(price > 0)) {
      if (!skipUnpriced) errors.push({ row, message: `Артикул ${sku}: нет цены` });
      return;
    }
    parsed.push({
      row,
      brand: findCanonicalBrand(brand) ?? brand,
      name,
      sku,
      price: kopecks(price),
      deliveryDays: parseDays(daysRaw),
      quality: parseQuality(qualityRaw),
      analog: String(analogRaw ?? "").trim() || null,
    });
  });

  // The same article twice in the file: the last line wins.
  const bySku = new Map<string, (typeof parsed)[number]>();
  const duplicates = new Set<string>();
  for (const r of parsed) {
    const key = skuKey(r.sku) + "|" + r.brand.toUpperCase();
    if (bySku.has(key)) duplicates.add(r.sku);
    bySku.set(key, r);
  }

  const products = await prisma.product.findMany({ select: { id: true, sku: true, brand: true, name: true } });
  const productsBySku = new Map<string, typeof products>();
  for (const p of products) productsBySku.set(skuKey(p.sku), [...(productsBySku.get(skuKey(p.sku)) ?? []), p]);
  const offers = await prisma.supplierOffer.findMany({ where: { supplierId }, select: { productId: true, price: true } });
  const offerOf = new Map(offers.map((o) => [o.productId, o.price]));

  const rows: OfferImportRow[] = [...bySku.values()].map((r) => {
    const candidates = productsBySku.get(skuKey(r.sku)) ?? [];
    // Same article in several brands: the brand decides.
    const product =
      candidates.length === 1
        ? candidates[0]
        : candidates.find((p) => (p.brand ?? "").toUpperCase() === r.brand.toUpperCase()) ?? null;
    if (!product) return { ...r, productId: null, productName: null, kind: "missing", oldPrice: null };
    const old = offerOf.get(product.id);
    return { ...r, productId: product.id, productName: product.name, kind: old === undefined ? "add" : "update", oldPrice: old ?? null };
  });
  return { rows, errors, duplicates: [...duplicates] };
}

const NEW_FROM_PRICE_CHECK = { slug: "iz-procenki", name: "Из проценки — не распределено" };

export type OfferWriteResult = { updated: number; added: number; created: number; skipped: number };

/**
 * Writes the analysed rows: offers of the supplier are added or updated;
 * with `createMissing`, unknown articles become new inactive products
 * (category «Из проценки — не распределено») with this offer.
 */
export async function writeOfferRows(supplierId: string, rows: OfferImportRow[], createMissing: boolean): Promise<OfferWriteResult> {
  let updated = 0;
  let added = 0;
  let created = 0;
  let skipped = 0;
  let categoryId: string | null = null;

  for (const r of rows) {
    if (!(r.price > 0)) continue;
    let productId = r.productId;
    if (!productId) {
      if (!createMissing || !r.name) {
        skipped++;
        continue;
      }
      if (!categoryId) {
        categoryId = (
          await prisma.category.upsert({
            where: { slug: NEW_FROM_PRICE_CHECK.slug },
            create: { ...NEW_FROM_PRICE_CHECK, isActive: false },
            update: {},
          })
        ).id;
      }
      const slug = buildProductSlug(r.brand || undefined, r.sku);
      if (await prisma.product.findFirst({ where: { OR: [{ sku: r.sku }, { slug }] }, select: { id: true } })) {
        skipped++;
        continue;
      }
      productId = (
        await prisma.product.create({
          data: { sku: r.sku, name: r.name, slug, brand: r.brand || null, price: 0, isActive: false, categoryId },
        })
      ).id;
      created++;
    } else if (r.kind === "update") updated++;
    else added++;

    await upsertSupplierOffer(prisma, productId, {
      supplierId,
      price: r.price,
      deliveryDays: r.deliveryDays,
      ...(r.quality ? { quality: String(r.quality).slice(0, 40) } : {}),
    });
    await syncSelectedOffer(prisma, productId);
  }
  return { updated, added, created, skipped };
}
