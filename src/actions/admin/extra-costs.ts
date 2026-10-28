"use server";

import path from "path";
import { mkdir, unlink, writeFile } from "fs/promises";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { accessDenied, requireSection } from "@/lib/access-server";
import { companyByInn, type SupplierLookup } from "@/lib/company-by-inn";
import { syncExtraCostRequest } from "@/lib/payment-requests";
import { EXTRA_COST_KINDS, EXTRA_COST_STATUSES, type ExtraCostInput } from "@/lib/validators/extra-costs";

export type ActionResult = { ok: true } | { ok: false; error: string };

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const FILES_DIR = path.join(process.cwd(), "public", "uploads", "extra-costs");

function revalidate() {
  revalidatePath("/admin/crm/extra-costs");
  revalidatePath("/admin/crm/orders");
}

/** Loaded when the card opens: companies, orders, employees, catalogue products and services. */
export async function getExtraCostFormData() {
  await requireSection("crm.extra-costs", "view");
  const [companies, orders, products, services, staff] = await Promise.all([
    prisma.company.findMany({ where: { isOwn: false }, select: { id: true, name: true, inn: true, kpp: true }, orderBy: { name: "asc" } }),
    prisma.order.findMany({
      select: { id: true, orderNumber: true, customerName: true, status: true },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
    prisma.product.findMany({ select: { id: true, sku: true, name: true, brand: true }, orderBy: { name: "asc" } }),
    prisma.service.findMany({ where: { isActive: true }, select: { id: true, name: true, unit: true, price: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { role: { notIn: ["CUSTOMER", "DRIVER"] } },
      select: { id: true, lastName: true, firstName: true, login: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ]);
  const employees = staff.map((u) => ({ id: u.id, name: [u.lastName, u.firstName].filter(Boolean).join(" ") || u.login }));
  return { companies, orders, products, services, employees };
}
export type ExtraCostFormData = Awaited<ReturnType<typeof getExtraCostFormData>>;

export type { SupplierLookup };

/** «Контрагент по ИНН»: a company of the site with it, else from ЕГРЮЛ/ЕГРИП as a new Поставщик. */
export async function supplierByInn(inn: string): Promise<SupplierLookup> {
  const denied = await accessDenied("crm.extra-costs");
  if (denied) return denied;
  return companyByInn(inn);
}

/** The card's «Сохранить»: the cost with its lines (JSON in `data`) and, optionally, a file. */
export async function saveExtraCost(formData: FormData): Promise<ActionResult> {
  const denied = await accessDenied("crm.extra-costs");
  if (denied) return denied;
  let input: ExtraCostInput;
  try {
    input = JSON.parse(String(formData.get("data") ?? ""));
  } catch {
    return { ok: false, error: "Некорректные данные" };
  }
  if (!(EXTRA_COST_KINDS as readonly string[]).includes(input.kind)) return { ok: false, error: "Выберите вид расходов" };
  if (!(EXTRA_COST_STATUSES as readonly string[]).includes(input.status)) return { ok: false, error: "Некорректный статус" };
  const date = new Date(`${input.date}T12:00:00+03:00`);
  if (Number.isNaN(date.getTime())) return { ok: false, error: "Укажите дату" };

  const lines = (Array.isArray(input.lines) ? input.lines : [])
    .filter((l) => String(l.name ?? "").trim())
    .map((l) => {
      const quantity = Number(l.quantity);
      const price = Math.round(Number(l.price));
      return {
        kind: l.kind === "SERVICE" ? "SERVICE" : "GOODS",
        productId: l.kind === "GOODS" ? l.productId || null : null,
        serviceId: l.kind === "SERVICE" ? l.serviceId || null : null,
        name: String(l.name).trim().slice(0, 300),
        quantity,
        price,
        sum: Math.round(quantity * price),
      };
    });
  if (lines.some((l) => !(l.quantity > 0) || !(l.price >= 0))) return { ok: false, error: "Проверьте количество и цену в строках" };
  const amount = lines.length ? lines.reduce((s, l) => s + l.sum, 0) : Math.round(Number(input.amount));
  if (!(amount > 0)) return { ok: false, error: "Укажите сумму или строки" };

  const file = formData.get("file");
  if (file instanceof File && file.size > MAX_FILE_SIZE) return { ok: false, error: "Файл больше 20 МБ" };

  const data = {
    kind: input.kind,
    number: String(input.number ?? "").trim().slice(0, 60),
    date,
    orderId: input.orderId || null,
    supplierId: input.supplierId || null,
    employeeId: input.employeeId || null,
    status: input.status,
    note: String(input.note ?? "").trim().slice(0, 1000) || null,
    amount,
  };
  const saved = input.id
    ? await prisma.$transaction(async (tx) => {
        await tx.extraCostLine.deleteMany({ where: { extraCostId: input.id! } });
        return tx.extraCost.update({ where: { id: input.id! }, data: { ...data, lines: { create: lines } } });
      })
    : await prisma.extraCost.create({ data: { ...data, lines: { create: lines } } });

  if (file instanceof File && file.size > 0) {
    const dir = path.join(FILES_DIR, saved.id);
    await mkdir(dir, { recursive: true });
    const stored = `${Date.now()}-${crypto.randomUUID()}${path.extname(file.name)}`;
    await writeFile(path.join(dir, stored), Buffer.from(await file.arrayBuffer()));
    if (saved.fileUrl) await unlink(path.join(process.cwd(), "public", saved.fileUrl)).catch(() => {});
    await prisma.extraCost.update({
      where: { id: saved.id },
      data: { fileName: file.name, fileUrl: `/uploads/extra-costs/${saved.id}/${stored}` },
    });
  }
  await syncExtraCostRequest(saved.id);
  revalidate();
  return { ok: true };
}

export async function setExtraCostStatus(id: string, status: string): Promise<ActionResult> {
  const denied = await accessDenied("crm.extra-costs");
  if (denied) return denied;
  if (!(EXTRA_COST_STATUSES as readonly string[]).includes(status)) return { ok: false, error: "Некорректный статус" };
  await prisma.extraCost.update({ where: { id: String(id) }, data: { status } });
  await syncExtraCostRequest(String(id));
  revalidate();
  return { ok: true };
}

export async function deleteExtraCost(id: string): Promise<ActionResult> {
  const denied = await accessDenied("crm.extra-costs");
  if (denied) return denied;
  const cost = await prisma.extraCost.delete({ where: { id: String(id) } }).catch(() => null);
  if (cost?.fileUrl) await unlink(path.join(process.cwd(), "public", cost.fileUrl)).catch(() => {});
  revalidate();
  return { ok: true };
}
