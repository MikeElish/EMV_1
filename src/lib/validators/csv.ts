import { z } from "zod";

// Column order is positional (left to right), not matched by header text —
// the header row is just human-readable labels for the admin filling the
// sheet, so the exact wording in row 1 doesn't matter for parsing.
export const IMPORT_COLUMN_ORDER = [
  "brand",
  "name",
  "sku",
  "stock",
  "price",
  "categorySlug",
  "machineType",
  "compatibleWith",
  "description",
  "images",
] as const;

export const IMPORT_COLUMN_LABELS: Record<
  (typeof IMPORT_COLUMN_ORDER)[number],
  string
> = {
  brand: "Бренд",
  name: "Наименование товара",
  sku: "Артикул товара",
  stock: "Количество в наличии",
  price: "Цена товара",
  categorySlug: "Категория товара",
  machineType: "Тип машины",
  compatibleWith: "Модель машины",
  description: "Описание",
  images: "Картинка",
};

export const csvRowSchema = z.object({
  brand: z.string().trim().min(1, "Бренд обязателен"),
  name: z.string().trim().min(1, "Наименование товара обязательно"),
  sku: z.string().trim().min(1, "Артикул товара обязателен"),
  // Empty or "0" means the product has no stock on hand -- it stays
  // importable and is simply shown storefront-side as "Под заказ".
  stock: z.coerce.number().int().min(0, "Количество должно быть целым числом ≥ 0"),
  price: z.coerce.number().min(0, "Цена должна быть числом ≥ 0"),
  // Matched against either the category's name or its slug (see
  // resolveImportCategory in actions/admin/import.ts) -- so Cyrillic names
  // like "Гидравлика" work here, not just the Latin slug.
  categorySlug: z.string().trim().min(1, "Категория товара обязательна"),
  machineType: z.string().trim().optional(),
  compatibleWith: z.string().trim().optional(),
  description: z.string().trim().optional(),
  images: z.string().trim().optional(),
});

export type CsvRow = z.infer<typeof csvRowSchema>;

// A row that passed csvRowSchema validation and had its category resolved
// to an existing Category, plus enough bookkeeping (row number, current DB
// stock if the SKU already exists) to drive the duplicate-SKU and
// stock-decrease review steps client-side before anything is written.
export type AnalyzedRow = CsvRow & {
  rowNumber: number;
  categoryId: string;
  /** Stock already in the system for this SKU, or null if it's a new product. */
  currentStock: number | null;
};

export type DuplicateGroup = {
  sku: string;
  rows: AnalyzedRow[];
};

export type ImportAnalysis = {
  errors: { row: number; message: string }[];
  duplicateGroups: DuplicateGroup[];
  singleRows: AnalyzedRow[];
};

export const CSV_TEMPLATE_HEADER = IMPORT_COLUMN_ORDER.map(
  (key) => IMPORT_COLUMN_LABELS[key]
).join(",");

export const CSV_TEMPLATE_EXAMPLE = [
  "CAT",
  "Гидроцилиндр стрелы",
  "EMV-1001",
  "3",
  "45000",
  "Гидравлика",
  "Экскаватор",
  "CAT 320|CAT 325",
  "Оригинальная запчасть",
  "",
].join(",");
