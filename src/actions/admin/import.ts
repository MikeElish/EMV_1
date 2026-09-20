"use server";

import { parse } from "csv-parse/sync";
import { read, utils } from "xlsx";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-dal";
import {
  csvRowSchema,
  IMPORT_COLUMN_ORDER,
  type AnalyzedRow,
  type DuplicateGroup,
  type ImportAnalysis,
} from "@/lib/validators/csv";
import { buildProductSlug } from "@/lib/slug";
import { rublesToKopecksRoundedUp } from "@/lib/money";
import { findCanonicalBrand } from "@/lib/normalize-brand";
import { applyWatermark } from "@/lib/watermark";
import { uploadWatermarkedImage } from "@/lib/image-storage";

export type ImportSummary = {
  ok: boolean;
  created: number;
  updated: number;
  errors: { row: number; message: string }[];
};

function splitList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Fetches each image URL from the import file, applies the same watermark
 * as the admin upload form, and re-hosts it on our own Blob storage -- a
 * broken/unreachable link is skipped rather than failing the whole row.
 */
async function resolveImportImages(urls: string[]): Promise<string[]> {
  const resolved: string[] = [];
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const buffer = Buffer.from(await response.arrayBuffer());
      const watermarked = await applyWatermark(buffer);
      resolved.push(await uploadWatermarkedImage(watermarked, `${crypto.randomUUID()}.jpg`));
    } catch {
      // Skip this image; the product itself is still created/updated.
    }
  }
  return resolved;
}

/**
 * Import sheets are filled in by hand, and admins naturally write the
 * category's human-readable Cyrillic name (e.g. "Гидравлика") rather than
 * its Latin slug ("gidravlika") -- so a row matches a category by either,
 * case- and whitespace-insensitively.
 */
function buildCategoryLookup(categories: { id: string; name: string; slug: string }[]) {
  const byKey = new Map<string, { id: string; name: string; slug: string }>();
  for (const category of categories) {
    byKey.set(category.slug.trim().toLowerCase(), category);
    byKey.set(category.name.trim().toLowerCase(), category);
  }
  return (value: string) => byKey.get(value.trim().toLowerCase());
}

function rowArrayToRecord(row: unknown[]): Record<string, string> {
  const record: Record<string, string> = {};
  IMPORT_COLUMN_ORDER.forEach((key, index) => {
    const value = row[index];
    record[key] = value == null ? "" : String(value).trim();
  });
  return record;
}

async function parseFileToRows(file: File): Promise<unknown[][]> {
  const isExcel = /\.xlsx?$/i.test(file.name);
  if (isExcel) {
    const buffer = await file.arrayBuffer();
    const workbook = read(buffer, { type: "buffer" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    return utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, defval: "" });
  }
  const text = await file.text();
  return parse(text, { columns: false, skip_empty_lines: true, trim: true });
}

/**
 * Parses and validates the uploaded file, but writes nothing to the
 * database. Resolves categories and looks up each SKU's current stock so
 * the client can run the admin through the duplicate-SKU and
 * stock-decrease review steps before anything is committed.
 */
export async function analyzeImportFile(formData: FormData): Promise<ImportAnalysis | { fileError: string }> {
  await verifyAdminSession();

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { fileError: "Файл не выбран" };
  }

  let rows: unknown[][];
  try {
    rows = await parseFileToRows(file);
  } catch (e) {
    return { fileError: `Не удалось разобрать файл: ${(e as Error).message}` };
  }

  // First row is always treated as a human-readable label row and skipped —
  // columns are matched by position, not by header text.
  const dataRows = rows.slice(1);

  const categories = await prisma.category.findMany();
  const resolveCategory = buildCategoryLookup(categories);

  const errors: { row: number; message: string }[] = [];
  const validRows: Omit<AnalyzedRow, "currentStock">[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const rowNumber = i + 2; // +1 for header row, +1 for 1-based
    const row = dataRows[i];
    if (row.every((cell) => cell === "" || cell == null)) continue; // skip blank rows

    const record = rowArrayToRecord(row);
    const parsed = csvRowSchema.safeParse(record);
    if (!parsed.success) {
      errors.push({ row: rowNumber, message: parsed.error.issues[0]?.message ?? "Некорректная строка" });
      continue;
    }

    const category = resolveCategory(parsed.data.categorySlug);
    if (!category) {
      errors.push({
        row: rowNumber,
        message: `Категория '${parsed.data.categorySlug}' не найдена (укажите название или slug существующей категории)`,
      });
      continue;
    }

    const brand = findCanonicalBrand(parsed.data.brand);
    if (!brand) {
      errors.push({
        row: rowNumber,
        message: `Бренд '${parsed.data.brand}' не найден в системе (укажите бренд из списка)`,
      });
      continue;
    }

    validRows.push({
      ...parsed.data,
      brand,
      rowNumber,
      categoryId: category.id,
    });
  }

  const skus = [...new Set(validRows.map((r) => r.sku))];
  const existingProducts = await prisma.product.findMany({
    where: { sku: { in: skus } },
    select: { sku: true, stock: true },
  });
  const stockBySku = new Map(existingProducts.map((p) => [p.sku, p.stock]));

  const analyzedRows: AnalyzedRow[] = validRows.map((r) => ({
    ...r,
    currentStock: stockBySku.get(r.sku) ?? null,
  }));

  const bySku = new Map<string, AnalyzedRow[]>();
  for (const row of analyzedRows) {
    const group = bySku.get(row.sku);
    if (group) group.push(row);
    else bySku.set(row.sku, [row]);
  }

  const duplicateGroups: DuplicateGroup[] = [];
  const singleRows: AnalyzedRow[] = [];
  for (const [sku, rowsForSku] of bySku) {
    if (rowsForSku.length > 1) duplicateGroups.push({ sku, rows: rowsForSku });
    else singleRows.push(rowsForSku[0]);
  }

  return { errors, duplicateGroups, singleRows };
}

/**
 * Writes the finalized, already-reviewed set of rows to the database.
 * Called after the client has resolved any duplicate-SKU picks and any
 * stock-decrease decisions from analyzeImportFile's result.
 */
export async function commitImportRows(rows: AnalyzedRow[]): Promise<ImportSummary> {
  await verifyAdminSession();

  let created = 0;
  let updated = 0;
  const errors: { row: number; message: string }[] = [];

  // Every row touched by this call shares one timestamp, so the whole batch
  // can later be recognized as "the last upload" (e.g. by the homepage's
  // "Новое поступление" rotator) via an exact newArrivalAt match.
  const importedAt = new Date();

  for (const row of rows) {
    const category = await prisma.category.findUnique({ where: { id: row.categoryId } });
    if (!category) {
      errors.push({ row: row.rowNumber, message: `Категория '${row.categorySlug}' не найдена` });
      continue;
    }

    const compatibleWith = splitList(row.compatibleWith);
    const attributes: Prisma.InputJsonObject = {
      ...(row.machineType ? { machineType: row.machineType } : {}),
      ...(compatibleWith.length > 0 ? { compatibleWith } : {}),
    };

    const data = {
      name: row.name,
      slug: buildProductSlug(row.brand, row.sku),
      description: row.description || null,
      price: rublesToKopecksRoundedUp(row.price),
      stock: row.stock,
      categoryId: category.id,
      brand: row.brand || null,
      images: await resolveImportImages(splitList(row.images)),
      attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
    };

    try {
      const existing = await prisma.product.findUnique({ where: { sku: row.sku } });
      if (existing) {
        const restocked = row.stock > existing.stock;
        await prisma.product.update({
          where: { sku: row.sku },
          data: { ...data, ...(restocked ? { newArrivalAt: importedAt } : {}) },
        });
        updated++;
      } else {
        await prisma.product.create({ data: { sku: row.sku, newArrivalAt: importedAt, ...data } });
        created++;
      }
    } catch (e) {
      errors.push({ row: row.rowNumber, message: (e as Error).message });
    }
  }

  revalidatePath("/admin/crm/products");
  revalidatePath("/shop");

  return { ok: errors.length === 0, created, updated, errors };
}
