"use server";

import path from "path";
import { mkdir, unlink, writeFile } from "fs/promises";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { accessDenied } from "@/lib/access-server";
import { getLogisticsSettings, saveLogisticsSettings, type LogisticsSettingsInput } from "@/lib/logistics";
import { EXTRA_COST_KINDS, EXTRA_COST_STATUSES } from "@/lib/validators/extra-costs";
import type { LogisticsRequestType, LogisticsRequestStatus } from "@prisma/client";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

const settingSchema = z.object({
  country: z.string().trim().min(1),
  city: z.string().trim().min(1),
  days: z.coerce.number().int().min(0).max(365),
});

export async function loadLogisticsSettings() {
  const denied = await accessDenied("settings.prices");
  if (denied) return denied;
  return { ok: true, settings: await getLogisticsSettings() } as const;
}

export async function upsertLogisticsSettings(input: LogisticsSettingsInput[]): Promise<ActionResult> {
  const denied = await accessDenied("settings.prices");
  if (denied) return denied;
  const parsed = z.array(settingSchema).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  await saveLogisticsSettings(parsed.data);
  revalidatePath("/admin/settings/prices");
  return { ok: true, message: "Настройки логистики сохранены" };
}

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const FILES_DIR = path.join(process.cwd(), "public", "uploads", "logistics");

export async function uploadLogisticsFile(requestId: string, formData: FormData): Promise<ActionResult> {
  const denied = await accessDenied("taxi.logistics");
  if (denied) return denied;
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) return { ok: false, error: "Выберите файл" };
  if (file.size > MAX_FILE_SIZE) return { ok: false, error: "Файл больше 20 МБ" };

  const request = await prisma.logisticsRequest.findUnique({ where: { id: requestId } });
  if (!request) return { ok: false, error: "Заявка не найдена" };

  const dir = path.join(FILES_DIR, requestId);
  await mkdir(dir, { recursive: true });
  const stored = `${Date.now()}-${crypto.randomUUID()}${path.extname(file.name)}`;
  await writeFile(path.join(dir, stored), Buffer.from(await file.arrayBuffer()));
  if (request.fileUrl) await unlink(path.join(process.cwd(), "public", request.fileUrl)).catch(() => {});
  await prisma.logisticsRequest.update({
    where: { id: requestId },
    data: { fileName: file.name, fileUrl: `/uploads/logistics/${requestId}/${stored}` },
  });
  revalidatePaths();
  return { ok: true };
}

export type LogisticsRequestInput = {
  id?: string;
  type: LogisticsRequestType;
  status: LogisticsRequestStatus;
  counterpartyId: string | null;
  address: string | null;
  fileName?: string | null;
  fileUrl?: string | null;
  documentKind?: string | null;
  cost?: number | null;
  executorId: string | null;
  orderId?: string | null;
  supplierPurchaseId?: string | null;
  executedAt?: string | null;
  lines: { productId: string; name: string; brand: string | null; sku: string | null; quantity: number; price: number; selected: boolean }[];
};

const requestSchema = z.object({
  id: z.string().trim().optional(),
  type: z.enum(["SEND", "RECEIVE"]),
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
  counterpartyId: z.string().trim().min(1).nullable(),
  address: z.string().trim().max(500).nullable(),
  documentKind: z.string().trim().max(50).nullable().optional(),
  cost: z.coerce.number().int().min(0).nullable().optional(),
  executorId: z.string().trim().min(1).nullable(),
  orderId: z.string().trim().min(1).nullable().optional(),
  supplierPurchaseId: z.string().trim().min(1).nullable().optional(),
  executedAt: z.string().trim().nullable().optional(),
  lines: z.array(z.object({
    productId: z.string().min(1),
    name: z.string().min(1),
    brand: z.string().nullable(),
    sku: z.string().nullable(),
    quantity: z.number().int().min(1),
    price: z.number().int().min(0),
    selected: z.boolean(),
  })).default([]),
});

function revalidatePaths() {
  revalidatePath("/admin/taxi-fleet/logistics");
  revalidatePath("/admin/crm/orders");
  revalidatePath("/admin/crm/supplier-orders");
  revalidatePath("/admin/warehouse/handover");
  revalidatePath("/admin/crm/extra-costs");
}

async function ensureInternalLogisticsService() {
  const name = "Внутренняя логистика";
  const existing = await prisma.service.findFirst({ where: { name } });
  if (existing) return existing.id;
  const created = await prisma.service.create({ data: { name, unit: "услуга", price: 0, isActive: true } });
  return created.id;
}

async function syncExtraCostFromLogistics(requestId: string) {
  const request = await prisma.logisticsRequest.findUnique({
    where: { id: requestId },
    include: { order: { select: { orderNumber: true } }, supplierPurchase: { select: { number: true } }, counterparty: { select: { name: true } } },
  });
  if (!request) return;
  const serviceId = await ensureInternalLogisticsService();
  const cost = request.cost ?? 0;
  const docNumber = `Л-${request.number}`;
  const existing = await prisma.extraCost.findFirst({ where: { number: docNumber } });

  const base = {
    kind: "Внутренняя логистика",
    serviceId,
    date: request.executedAt ?? request.createdAt,
    supplierId: request.counterpartyId,
    employeeId: request.executorId,
    orderId: request.orderId,
    amount: cost,
    status: request.status === "CANCELLED" ? "Отменено" : request.status === "COMPLETED" ? "Оплачено" : "Требуется оплата",
    note: request.address,
    number: docNumber,
  };

  if (existing) {
    await prisma.extraCost.update({ where: { id: existing.id }, data: base });
  } else {
    await prisma.extraCost.create({ data: base });
  }
}

export async function saveLogisticsRequest(input: LogisticsRequestInput): Promise<ActionResult & { id?: string }> {
  const denied = await accessDenied("taxi.logistics");
  if (denied) return denied;
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };

  const data = parsed.data;
  const executedAt = data.executedAt ? new Date(`${data.executedAt}T12:00:00+03:00`) : null;
  const selectedLines = data.lines.filter((l) => l.selected);
  const amount = selectedLines.reduce((sum, l) => sum + l.quantity * l.price, 0);

  const saved = data.id
    ? await prisma.logisticsRequest.update({
        where: { id: data.id },
        data: {
          type: data.type,
          status: data.status,
          counterpartyId: data.counterpartyId,
          address: data.address,
          documentKind: data.documentKind,
          cost: data.cost ?? null,
          executorId: data.executorId,
          orderId: data.orderId ?? null,
          supplierPurchaseId: data.supplierPurchaseId ?? null,
          executedAt,
        },
      })
    : await prisma.logisticsRequest.create({
        data: {
          type: data.type,
          status: data.status,
          counterpartyId: data.counterpartyId,
          address: data.address,
          documentKind: data.documentKind,
          cost: data.cost ?? null,
          executorId: data.executorId,
          orderId: data.orderId ?? null,
          supplierPurchaseId: data.supplierPurchaseId ?? null,
          executedAt,
        },
      });

  await syncExtraCostFromLogistics(saved.id);
  revalidatePaths();
  return { ok: true, message: "Заявка сохранена", id: saved.id };
}

export async function getLogisticsRequests() {
  const denied = await accessDenied("taxi.logistics");
  if (denied) return denied;
  const requests = await prisma.logisticsRequest.findMany(logisticsRequestListArgs);
  return { ok: true, requests } as const;
}

type LogisticsRequestListArgs = {
  orderBy: { createdAt: "desc" }[];
  include: {
    counterparty: { select: { id: true; name: true } };
    executor: { select: { id: true; lastName: true; firstName: true; login: true } };
    order: { select: { id: true; orderNumber: true } };
    supplierPurchase: { select: { id: true; number: true } };
  };
};

const logisticsRequestListArgs: LogisticsRequestListArgs = {
  orderBy: [{ createdAt: "desc" }],
  include: {
    counterparty: { select: { id: true, name: true } },
    executor: { select: { id: true, lastName: true, firstName: true, login: true } },
    order: { select: { id: true, orderNumber: true } },
    supplierPurchase: { select: { id: true, number: true } },
  },
};

export type LogisticsRequestListItem = {
  id: string;
  number: number;
  type: "SEND" | "RECEIVE";
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  counterpartyId: string | null;
  address: string | null;
  fileName: string | null;
  fileUrl: string | null;
  documentKind: string | null;
  cost: number | null;
  executorId: string | null;
  orderId: string | null;
  supplierPurchaseId: string | null;
  executedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  counterparty: { id: string; name: string } | null;
  executor: { id: string; lastName: string | null; firstName: string | null; login: string } | null;
  order: { id: string; orderNumber: string } | null;
  supplierPurchase: { id: string; number: number } | null;
};

export async function getLogisticsFormData() {
  const denied = await accessDenied("taxi.logistics");
  if (denied) return denied;
  const [companies, employees, orders, purchases] = await Promise.all([
    prisma.company.findMany({ where: { isOwn: false }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { role: { notIn: ["CUSTOMER", "DRIVER"] } },
      select: { id: true, lastName: true, firstName: true, login: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.order.findMany({
      select: { id: true, orderNumber: true, customerName: true, status: true },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
    prisma.supplierPurchase.findMany({
      select: { id: true, number: true, supplier: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
  ]);
  return { ok: true, companies, employees, orders, purchases } as const;
}

export type LogisticsFormData = {
  companies: { id: string; name: string }[];
  employees: { id: string; lastName: string | null; firstName: string | null; login: string }[];
  orders: { id: string; orderNumber: string; customerName: string; status: string }[];
  purchases: { id: string; number: number; supplier: { name: string } | null }[];
};
