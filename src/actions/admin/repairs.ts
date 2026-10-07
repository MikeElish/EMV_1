"use server";

import { revalidatePath } from "next/cache";
import type { RepairLineKind, RepairStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { accessDenied, requireSection } from "@/lib/access-server";
import { repairLineSchema, repairSchema, REPAIR_STATUS_LABELS, type RepairInput, type RepairLineInput } from "@/lib/validators/repairs";
import { deleteRepairDocumentFile, uploadRepairDocumentFile } from "@/lib/repair-document-storage";

export type ActionResult = { ok: true } | { ok: false; error: string };

const SECTION = "taxi.repair";
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const revalidate = () => revalidatePath("/admin/taxi-fleet/repair");
const firstIssue = (e: { issues: { message: string }[] }) => e.issues[0]?.message ?? "Некорректные данные";

// ---- Repair cards ---------------------------------------------------------------

/** Creates (no id) or edits a repair card. */
export async function saveRepair(id: string | null, input: RepairInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const denied = await accessDenied(SECTION);
  if (denied) return denied;
  const parsed = repairSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { date, note, ...rest } = parsed.data;
  if (!(await prisma.vehicle.findUnique({ where: { id: rest.vehicleId }, select: { id: true } }))) {
    return { ok: false, error: "Техника не найдена" };
  }
  const data = { ...rest, date: new Date(`${date}T00:00:00Z`), note: note || null };
  if (id) {
    const updated = await prisma.repair.updateMany({ where: { id }, data });
    if (!updated.count) return { ok: false, error: "Карточка ремонта не найдена" };
    revalidate();
    return { ok: true, id };
  }
  const created = await prisma.repair.create({ data });
  revalidate();
  return { ok: true, id: created.id };
}

/** Статус from the list on the left. */
export async function setRepairStatus(id: string, status: RepairStatus): Promise<ActionResult> {
  const denied = await accessDenied(SECTION);
  if (denied) return denied;
  if (!(status in REPAIR_STATUS_LABELS)) return { ok: false, error: "Некорректный статус" };
  const updated = await prisma.repair.updateMany({ where: { id }, data: { status } });
  if (!updated.count) return { ok: false, error: "Карточка ремонта не найдена" };
  revalidate();
  return { ok: true };
}

export async function deleteRepair(id: string): Promise<ActionResult> {
  const denied = await accessDenied(SECTION);
  if (denied) return denied;
  const docs = await prisma.repairDocument.findMany({ where: { repairId: id }, select: { fileUrl: true } });
  await prisma.repair.deleteMany({ where: { id } });
  await Promise.all(docs.map((d) => deleteRepairDocumentFile(d.fileUrl)));
  revalidate();
  return { ok: true };
}

// ---- Works and materials -------------------------------------------------------------

export type RepairCatalogItem = { id: string; name: string; sku: string | null; unit: string | null; price: number };

/**
 * Catalogue search for a line: Услуги (works) or Товары (materials). A
 * material is priced at its purchase price (the selected supplier offer),
 * else at the site price.
 */
export async function searchRepairCatalog(kind: RepairLineKind, query: string): Promise<RepairCatalogItem[]> {
  await requireSection(SECTION, "view");
  const q = query.trim();
  if (kind === "SERVICE") {
    const services = await prisma.service.findMany({
      where: { isActive: true, ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }] } : {}) },
      orderBy: { name: "asc" },
      take: 20,
    });
    return services.map((s) => ({ id: s.id, name: s.name, sku: s.code, unit: s.unit, price: s.price }));
  }
  if (!q) return [];
  const products = await prisma.product.findMany({
    where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }] },
    select: { id: true, name: true, sku: true, price: true, offers: { where: { selected: true }, select: { price: true } } },
    orderBy: { name: "asc" },
    take: 20,
  });
  return products.map((p) => ({ id: p.id, name: p.name, sku: p.sku, unit: null, price: p.offers[0]?.price ?? p.price }));
}

/** Adds (no lineId) or edits a work / material of a repair. */
export async function saveRepairLine(repairId: string, lineId: string | null, input: RepairLineInput): Promise<ActionResult> {
  const denied = await accessDenied(SECTION);
  if (denied) return denied;
  const parsed = repairLineSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { kind, productId, serviceId, name, quantity, price } = parsed.data;
  if (!(await prisma.repair.findUnique({ where: { id: repairId }, select: { id: true } }))) {
    return { ok: false, error: "Карточка ремонта не найдена" };
  }
  // The catalogue card it was picked from, if it still exists.
  const linkedProduct = kind === "PRODUCT" && productId ? await prisma.product.findUnique({ where: { id: productId }, select: { id: true } }) : null;
  const linkedService = kind === "SERVICE" && serviceId ? await prisma.service.findUnique({ where: { id: serviceId }, select: { id: true } }) : null;
  const data = {
    kind,
    name,
    quantity,
    price: Math.round(price * 100),
    productId: linkedProduct?.id ?? null,
    serviceId: linkedService?.id ?? null,
  };
  if (lineId) {
    const updated = await prisma.repairLine.updateMany({ where: { id: lineId, repairId }, data });
    if (!updated.count) return { ok: false, error: "Позиция не найдена" };
  } else {
    await prisma.repairLine.create({ data: { repairId, ...data } });
  }
  revalidate();
  return { ok: true };
}

export async function deleteRepairLine(id: string): Promise<ActionResult> {
  const denied = await accessDenied(SECTION);
  if (denied) return denied;
  await prisma.repairLine.deleteMany({ where: { id } });
  revalidate();
  return { ok: true };
}

// ---- Files ----------------------------------------------------------------------------

export async function listRepairDocuments(repairId: string) {
  await requireSection(SECTION, "view");
  return prisma.repairDocument.findMany({ where: { repairId }, orderBy: { uploadedAt: "desc" } });
}

export async function uploadRepairDocument(formData: FormData): Promise<ActionResult> {
  const denied = await accessDenied(SECTION);
  if (denied) return denied;
  const repairId = String(formData.get("repairId") ?? "");
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) return { ok: false, error: "Файл не выбран" };
  if (file.size > MAX_FILE_SIZE) return { ok: false, error: "Файл слишком большой (максимум 20 МБ)" };
  if (!(await prisma.repair.findUnique({ where: { id: repairId }, select: { id: true } }))) {
    return { ok: false, error: "Карточка ремонта не найдена" };
  }
  const fileUrl = await uploadRepairDocumentFile(repairId, Buffer.from(await file.arrayBuffer()), file.name);
  await prisma.repairDocument.create({ data: { repairId, fileName: file.name, fileUrl } });
  revalidate();
  return { ok: true };
}

export async function deleteRepairDocument(id: string): Promise<ActionResult> {
  const denied = await accessDenied(SECTION);
  if (denied) return denied;
  const doc = await prisma.repairDocument.findUnique({ where: { id } });
  if (!doc) return { ok: false, error: "Файл не найден" };
  await deleteRepairDocumentFile(doc.fileUrl);
  await prisma.repairDocument.delete({ where: { id } });
  revalidate();
  return { ok: true };
}
