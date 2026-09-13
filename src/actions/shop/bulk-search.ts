"use server";

import { read, utils } from "xlsx";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { matchRows, type BulkSearchRow } from "@/lib/bulk-search-match";
import { logProductSearches } from "@/actions/shop/search-log";
import { normalizeBrand } from "@/lib/normalize-brand";

async function parseFileToRows(file: File): Promise<unknown[][]> {
  const buffer = await file.arrayBuffer();
  const workbook = read(buffer, { type: "buffer" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  return utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, defval: "" });
}

export async function bulkSearchProducts(
  formData: FormData
): Promise<{ fileError: string } | never> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { fileError: "Некорректный файл" };
  }
  if (!/\.xlsx?$/i.test(file.name)) {
    return { fileError: "Некорректный файл" };
  }

  let sheetRows: unknown[][];
  try {
    sheetRows = await parseFileToRows(file);
  } catch {
    return { fileError: "Некорректный файл" };
  }

  // First row is the human-readable header ("Бренд", "Артикул",
  // "Количество") -- columns are matched by position, not by header text.
  const dataRows = sheetRows.slice(1).filter((row) => row.some((cell) => String(cell).trim() !== ""));

  if (dataRows.length === 0) {
    return { fileError: "Некорректный файл" };
  }

  const rows: BulkSearchRow[] = [];
  for (const row of dataRows) {
    const brand = normalizeBrand(String(row[0] ?? ""));
    const sku = String(row[1] ?? "").trim();
    const quantity = Number(row[2]);
    if (!brand || !sku || !Number.isFinite(quantity)) {
      return { fileError: "Некорректный файл" };
    }
    rows.push({ brand, sku, quantity });
  }

  const products = await prisma.product.findMany({ where: { isActive: true } });
  const matched = matchRows(rows, products);

  const created = await prisma.bulkSearchRequest.create({
    data: { rows },
  });

  after(() =>
    logProductSearches(
      matched.map((row) =>
        row.product
          ? {
              productId: row.product.id,
              brand: row.product.brand ?? row.brand,
              sku: row.product.sku,
              name: row.product.name,
              inSystem: true,
            }
          : {
              productId: null,
              brand: row.brand,
              sku: row.sku,
              name: null,
              inSystem: false,
            }
      )
    )
  );

  redirect(`/shop/search/bulk/${created.id}`);
}
