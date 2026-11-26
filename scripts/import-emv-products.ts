import { read, utils } from "xlsx";
import { prisma } from "@/lib/prisma";
import { buildProductSlug } from "@/lib/slug";
import { findCanonicalBrand } from "@/lib/normalize-brand";
import { Prisma } from "@prisma/client";

const FILE_PATH = process.argv[2] || "C:/Users/79132/Downloads/emv-products-template.xlsx";
const DRY_RUN = process.argv.includes("--dry-run");

type RawRow = {
  brand?: string;
  name?: string;
  sku?: string;
  category?: string;
};

function normalize(value: unknown): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s === "" ? undefined : s;
}

function rowToObject(row: unknown[]): RawRow {
  return {
    brand: normalize(row[0]),
    name: normalize(row[1]),
    sku: normalize(row[2]),
    category: normalize(row[9]),
  };
}

async function main() {
  const workbook = read(FILE_PATH, { type: "file" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  const dataRows = rows.slice(1);

  const [categories, existingProducts] = await Promise.all([
    prisma.category.findMany(),
    prisma.product.findMany({ select: { sku: true } }),
  ]);
  const existingSkus = new Set(existingProducts.map((p) => p.sku));

  const categoryByKey = new Map<string, { id: string; name: string; slug: string }>();
  for (const c of categories) {
    categoryByKey.set(c.name.trim().toLowerCase(), c);
    categoryByKey.set(c.slug.trim().toLowerCase(), c);
  }

  const uniqueRows = new Map<string, RawRow>();
  const errors: string[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const rowNumber = i + 2;
    const row = rowToObject(dataRows[i]);
    if (!row.brand && !row.name && !row.sku && !row.category) continue;

    if (!row.brand || !row.name || !row.sku || !row.category) {
      errors.push(`Строка ${rowNumber}: не заполнены обязательные поля`);
      continue;
    }

    const brand = findCanonicalBrand(row.brand);
    if (!brand) {
      errors.push(`Строка ${rowNumber}: бренд '${row.brand}' не найден`);
      continue;
    }

    const category = categoryByKey.get(row.category.trim().toLowerCase());
    if (!category) {
      errors.push(`Строка ${rowNumber}: категория '${row.category}' не найдена`);
      continue;
    }

    const key = `${brand}|${row.sku.trim()}`;
    if (!uniqueRows.has(key)) {
      uniqueRows.set(key, { ...row, brand, category: category.name });
    }
  }

  console.log(`Уникальных товаров: ${uniqueRows.size}`);
  console.log(`Ошибок в файле: ${errors.length}`);
  if (errors.length > 0) {
    console.log("Ошибки:");
    errors.forEach((e) => console.log("  -", e));
  }

  const toCreate: { sku: string; name: string; brand: string; categoryId: string; slug: string }[] = [];
  const alreadyExist: string[] = [];

  for (const [key, row] of uniqueRows) {
    const sku = row.sku!.trim();
    if (existingSkus.has(sku)) {
      alreadyExist.push(sku);
      continue;
    }
    const category = categoryByKey.get(row.category!.trim().toLowerCase())!;
    toCreate.push({
      sku,
      name: row.name!,
      brand: row.brand!,
      categoryId: category.id,
      slug: buildProductSlug(row.brand!, sku),
    });
  }

  console.log(`Будет создано: ${toCreate.length}`);
  console.log(`Уже существует: ${alreadyExist.length}`);

  if (DRY_RUN) {
    console.log("Dry run — ничего не записываем.");
    toCreate.slice(0, 10).forEach((p) => console.log("  Пример:", p));
    return;
  }

  const created: string[] = [];
  for (const p of toCreate) {
    try {
      await prisma.product.create({
        data: {
          sku: p.sku,
          name: p.name,
          slug: p.slug,
          description: null,
          price: 0,
          stock: 0,
          categoryId: p.categoryId,
          brand: p.brand,
          images: [],
          attributes: {},
          noOffer: true,
        },
      });
      created.push(p.sku);
    } catch (e) {
      errors.push(`Ошибка создания ${p.sku}: ${(e as Error).message}`);
    }
  }

  console.log(`Создано: ${created.length}`);
  if (errors.length > 0) {
    console.log("Ошибки при записи:");
    errors.forEach((e) => console.log("  -", e));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
