"use server";

import { revalidatePath } from "next/cache";
import { parse } from "csv-parse/sync";
import { read, utils } from "xlsx";
import { prisma } from "@/lib/prisma";
import { accessDenied, requireSection } from "@/lib/access-server";
import { findCanonicalBrand } from "@/lib/normalize-brand";
import { buildProductSlug } from "@/lib/slug";
import { uploadOfferFile, deleteOfferFile } from "@/lib/offer-file-storage";
import { selectOffer, syncSelectedOffer, upsertSupplierOffer } from "@/lib/supplier-offers";

export type ActionResult = { ok: true } | { ok: false; error: string };

const MAX_FILE_SIZE = 20 * 1024 * 1024;
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

export type OfferImportRow = {
  row: number;
  brand: string;
  name: string;
  sku: string;
  price: number; // kopecks
  deliveryDays: number | null;
  productId: string | null;
  productName: string | null;
  /** update: the supplier already has an offer; add: new offer; missing: no such article. */
  kind: "update" | "add" | "missing";
  oldPrice: number | null;
};

export type OfferImportAnalysis =
  | { ok: true; rows: OfferImportRow[]; errors: { row: number; message: string }[]; duplicates: string[] }
  | { ok: false; error: string };

async function fileRows(file: File): Promise<unknown[][]> {
  if (/\.(xlsx|xls|ods)$/i.test(file.name)) {
    const workbook = read(Buffer.from(await file.arrayBuffer()), { type: "buffer" });
    return utils.sheet_to_json<unknown[]>(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: "" });
  }
  return parse(await file.text(), { columns: false, skip_empty_lines: true, trim: true });
}

const IMPORT_COLUMNS: RegExp[] = [
  /^бренд|^производител/,
  /^наименование/,
  /^артикул/,
  /^цена/,
  /^итого|^всего|^сумма/,
  /^срок/,
];

/**
 * Where Бренд, Наименование, Артикул, Цена, Итого, Срок поставки are: found
 * by the header row (so a file from «Выгрузка», with «Количество», loads
 * too), or in this order when the headers aren't recognised.
 */
function columnPositions(header: unknown[]): number[] {
  const names = header.map((h) => String(h ?? "").trim().toLowerCase());
  const found = IMPORT_COLUMNS.map((re) => names.findIndex((n) => re.test(n)));
  return found[2] >= 0 && (found[3] >= 0 || found[4] >= 0) ? found : IMPORT_COLUMNS.map((_, i) => i);
}

/**
 * Reads a supplier price file -- columns Бренд, Наименование, Артикул, Цена,
 * Итого, Срок поставки (first row = headers) -- and matches it with the
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
    raw = await fileRows(file);
  } catch (e) {
    return { ok: false, error: `Не удалось разобрать файл: ${(e as Error).message}` };
  }

  const errors: { row: number; message: string }[] = [];
  const parsed: Omit<OfferImportRow, "productId" | "productName" | "kind" | "oldPrice">[] = [];
  const at = columnPositions(raw[0] ?? []);
  raw.slice(1).forEach((cells, i) => {
    const row = i + 2;
    if (cells.every((c) => c === "" || c == null)) return;
    const [brandRaw, nameRaw, skuRaw, priceRaw, totalRaw, daysRaw] = at.map((p) => (p < 0 ? "" : cells[p]));
    const sku = String(skuRaw ?? "").trim();
    const name = String(nameRaw ?? "").trim();
    const brand = String(brandRaw ?? "").trim();
    // «Цена»; when the file has only «Итого», that one.
    const price = String(priceRaw ?? "").trim() ? num(priceRaw) : num(totalRaw);
    if (!sku) return errors.push({ row, message: "Нет артикула" });
    if (!(price > 0)) return errors.push({ row, message: `Артикул ${sku}: нет цены` });
    parsed.push({ row, brand: findCanonicalBrand(brand) ?? brand, name, sku, price: kopecks(price), deliveryDays: parseDays(daysRaw) });
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
  return { ok: true, rows, errors, duplicates: [...duplicates] };
}

const NEW_FROM_PRICE_CHECK = { slug: "iz-procenki", name: "Из проценки — не распределено" };

/**
 * Writes the analysed file: offers of the supplier are added or updated;
 * with `createMissing`, unknown articles become new inactive products
 * (category «Из проценки — не распределено») with this offer.
 */
export async function commitOfferImport(input: {
  supplierId: string;
  rows: OfferImportRow[];
  createMissing: boolean;
}): Promise<{ ok: true; updated: number; added: number; created: number; skipped: number } | { ok: false; error: string }> {
  const denied = await accessDenied("crm.price-check");
  if (denied) return denied;
  const supplier = await prisma.company.findUnique({ where: { id: input.supplierId }, select: { id: true } });
  if (!supplier) return { ok: false, error: "Поставщик не найден" };

  let updated = 0;
  let added = 0;
  let created = 0;
  let skipped = 0;
  let categoryId: string | null = null;

  for (const r of input.rows) {
    if (!(r.price > 0)) continue;
    let productId = r.productId;
    if (!productId) {
      if (!input.createMissing || !r.name) {
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

    await upsertSupplierOffer(prisma, productId, { supplierId: input.supplierId, price: r.price, deliveryDays: r.deliveryDays });
    await syncSelectedOffer(prisma, productId);
  }
  revalidate();
  return { ok: true, updated, added, created, skipped };
}

export async function deleteSupplierOrderLine(id: string): Promise<ActionResult> {
  const denied = await accessDenied("crm.supplier-orders");
  if (denied) return denied;
  await prisma.supplierOrderLine.deleteMany({ where: { id } });
  revalidatePath("/admin/crm/supplier-orders");
  return { ok: true };
}
