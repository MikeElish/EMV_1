"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { accessDenied } from "@/lib/access-server";
import { prisma } from "@/lib/prisma";
import { parseSupplierCurrency, type SupplierCurrency } from "@/lib/supplier-currency";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type PartnerStockView = {
  id: string;
  supplierId: string;
  supplierName: string;
  productId: string | null;
  offerId: string | null;
  brand: string | null;
  name: string | null;
  sku: string | null;
  quantity: number | null;
  price: number | null;
  total: number | null;
  source: string;
  updatedAt: Date;
};

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const kopecks = (rub: number) => Math.round(rub * 100);
const num = (v: unknown) => {
  const n = Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

export async function listPartnerStocks(supplierId?: string | null): Promise<PartnerStockView[]> {
  await accessDenied("warehouse.partner-network", "view");
  const stocks = await prisma.partnerStock.findMany({
    where: supplierId ? { supplierId } : undefined,
    include: { supplier: { select: { name: true } }, product: { select: { brand: true, name: true, sku: true } } },
    orderBy: [{ supplier: { name: "asc" } }, { updatedAt: "desc" }],
  });
  return stocks.map((s) => ({
    id: s.id,
    supplierId: s.supplierId,
    supplierName: s.supplier.name,
    productId: s.productId,
    offerId: s.offerId,
    brand: s.brand ?? s.product?.brand ?? null,
    name: s.name ?? s.product?.name ?? null,
    sku: s.sku ?? s.product?.sku ?? null,
    quantity: s.quantity,
    price: s.price,
    total: s.total,
    source: s.source,
    updatedAt: s.updatedAt,
  }));
}

export async function getSuppliers() {
  return prisma.company.findMany({
    where: { type: { equals: "Поставщик", mode: "insensitive" } },
    select: { id: true, name: true, inn: true },
    orderBy: { name: "asc" },
  });
}

export async function savePartnerStock(
  id: string | null,
  data: {
    supplierId: string;
    productId?: string | null;
    brand?: string | null;
    name?: string | null;
    sku?: string | null;
    quantity?: number | null;
    price?: number | null;
    total?: number | null;
  }
): Promise<ActionResult> {
  const denied = await accessDenied("warehouse.partner-network");
  if (denied) return denied;
  if (!data.supplierId) return { ok: false, error: "Выберите поставщика" };
  const supplier = await prisma.company.findUnique({ where: { id: data.supplierId }, select: { id: true } });
  if (!supplier) return { ok: false, error: "Поставщик не найден" };

  const quantity = data.quantity ?? null;
  const price = data.price ?? null;
  const total = data.total ?? (quantity !== null && price !== null ? quantity * price : null);

  if (id) {
    await prisma.partnerStock.update({
      where: { id },
      data: {
        supplierId: data.supplierId,
        productId: data.productId ?? null,
        brand: data.brand?.trim() || null,
        name: data.name?.trim() || null,
        sku: data.sku?.trim() || null,
        quantity,
        price,
        total,
        source: "MANUAL",
      },
    });
  } else {
    await prisma.partnerStock.create({
      data: {
        supplierId: data.supplierId,
        productId: data.productId ?? null,
        brand: data.brand?.trim() || null,
        name: data.name?.trim() || null,
        sku: data.sku?.trim() || null,
        quantity,
        price,
        total,
        source: "MANUAL",
      },
    });
  }
  revalidatePath("/admin/warehouse/partner-network");
  return { ok: true };
}

export async function deletePartnerStock(id: string): Promise<ActionResult> {
  const denied = await accessDenied("warehouse.partner-network");
  if (denied) return denied;
  await prisma.partnerStock.delete({ where: { id } });
  revalidatePath("/admin/warehouse/partner-network");
  return { ok: true };
}

export async function importPartnerStockFile(formData: FormData): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const denied = await accessDenied("warehouse.partner-network");
  if (denied) return { ok: false, error: denied.error };
  const supplierId = String(formData.get("supplierId") ?? "");
  const file = formData.get("file");
  if (!supplierId) return { ok: false, error: "Выберите поставщика" };
  if (!(file instanceof File) || !file.size) return { ok: false, error: "Выберите файл" };
  if (file.size > MAX_FILE_SIZE) return { ok: false, error: "Файл больше 20 МБ" };
  const supplier = await prisma.company.findUnique({ where: { id: supplierId }, select: { id: true } });
  if (!supplier) return { ok: false, error: "Поставщик не найден" };

  let raw: unknown[][];
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    if (file.name.toLowerCase().endsWith(".csv")) {
      raw = bytes.toString("utf8").split("\n").map((line) => line.split(";").map((cell) => cell.trim()));
    } else {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(bytes as unknown as Parameters<typeof workbook.xlsx.load>[0]);
      const sheet = workbook.worksheets[0];
      if (!sheet) return { ok: false, error: "В файле нет листа" };
      raw = [];
      sheet.eachRow((row) => raw.push(row.values as unknown[]));
    }
  } catch (e) {
    return { ok: false, error: `Не удалось прочитать файл: ${(e as Error).message}` };
  }

  const header = (raw[0] ?? []).map((v) => String(v ?? "").trim().toLowerCase());
  const brandCol = header.findIndex((h) => /^бренд|^производитель/.test(h));
  const skuCol = header.findIndex((h) => /^артикул/.test(h));
  const qtyCol = header.findIndex((h) => /^кол/.test(h));
  const priceCol = header.findIndex((h) => /^цена/.test(h));
  if (brandCol < 0 || skuCol < 0 || qtyCol < 0 || priceCol < 0) {
    return { ok: false, error: "В файле должны быть столбцы: Бренд, Артикул, Количество, Цена" };
  }

  const products = await prisma.product.findMany({ select: { id: true, sku: true, brand: true } });
  const bySku = new Map<string, typeof products>();
  for (const p of products) bySku.set(p.sku.toUpperCase().replace(/[\s\-_.\/\\]/g, ""), [...(bySku.get(p.sku.toUpperCase().replace(/[\s\-_.\/\\]/g, "")) ?? []), p]);

  let count = 0;
  await prisma.$transaction(async (tx) => {
    for (let i = 1; i < raw.length; i++) {
      const cells = raw[i];
      if (!cells || cells.every((c) => c === "" || c == null)) continue;
      const brand = String(cells[brandCol] ?? "").trim();
      const sku = String(cells[skuCol] ?? "").trim();
      const qty = num(cells[qtyCol]);
      const priceVal = num(cells[priceCol]);
      if (!sku || !(qty >= 0) || !(priceVal >= 0)) continue;
      const price = kopecks(priceVal);
      const total = Math.round(qty * price);
      const candidates = bySku.get(sku.toUpperCase().replace(/[\s\-_.\/\\]/g, "")) ?? [];
      const product = candidates.length === 1 ? candidates[0] : candidates.find((p) => (p.brand ?? "").toUpperCase() === brand.toUpperCase()) ?? null;
      await tx.partnerStock.upsert({
        where: { supplierId_sku: { supplierId, sku } },
        create: {
          supplierId,
          productId: product?.id ?? null,
          brand: brand || null,
          sku,
          quantity: Math.round(qty),
          price,
          total,
          source: "MANUAL",
        },
        update: {
          brand: brand || null,
          sku,
          quantity: Math.round(qty),
          price,
          total,
          source: "MANUAL",
        },
      });
      count++;
    }
  });
  revalidatePath("/admin/warehouse/partner-network");
  return { ok: true, count };
}
