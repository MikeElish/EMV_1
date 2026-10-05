"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { accessDenied, requireSection } from "@/lib/access-server";
import { vehicleSchema, type VehicleInput } from "@/lib/validators/taxi-fleet";
import {
  uploadVehicleDocumentFile,
  deleteVehicleDocumentFile,
} from "@/lib/vehicle-document-storage";

export type ActionResult = { ok: true } | { ok: false; error: string };

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const DUPLICATE_ERROR = "Автомобиль с таким гос.номером или VIN-номером уже существует";

function parseVehicleFormData(formData: FormData) {
  return vehicleSchema.safeParse({
    brand: formData.get("brand"),
    model: formData.get("model"),
    licensePlate: formData.get("licensePlate"),
    vin: formData.get("vin"),
    color: formData.get("color"),
    year: formData.get("year"),
    ptsNumber: formData.get("ptsNumber"),
    ptsIssueDate: formData.get("ptsIssueDate"),
    stsNumber: formData.get("stsNumber"),
    stsIssueDate: formData.get("stsIssueDate"),
  });
}

function toVehicleData(data: VehicleInput) {
  return {
    brand: data.brand,
    model: data.model,
    licensePlate: data.licensePlate,
    vin: data.vin,
    color: data.color,
    year: data.year,
    ptsNumber: data.ptsNumber,
    ptsIssueDate: new Date(data.ptsIssueDate),
    stsNumber: data.stsNumber,
    stsIssueDate: new Date(data.stsIssueDate),
  };
}

export async function createVehicle(formData: FormData): Promise<ActionResult> {
  const denied = await accessDenied("taxi.tech");
  if (denied) return denied;

  const parsed = parseVehicleFormData(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  const files = formData.getAll("documents").filter((f): f is File => f instanceof File && f.size > 0);
  const oversized = files.find((f) => f.size > MAX_FILE_SIZE);
  if (oversized) {
    return { ok: false, error: `Файл «${oversized.name}» слишком большой (максимум 20 МБ)` };
  }

  let vehicle;
  try {
    vehicle = await prisma.vehicle.create({ data: toVehicleData(parsed.data) });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: DUPLICATE_ERROR };
    }
    throw e;
  }

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileUrl = await uploadVehicleDocumentFile(vehicle.id, buffer, file.name);
    await prisma.vehicleDocument.create({ data: { vehicleId: vehicle.id, fileName: file.name, fileUrl } });
  }

  revalidatePath("/admin/taxi-fleet/tech");
  redirect("/admin/taxi-fleet/tech");
}

export async function updateVehicle(id: string, formData: FormData): Promise<ActionResult> {
  const denied = await accessDenied("taxi.tech");
  if (denied) return denied;

  const parsed = parseVehicleFormData(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  try {
    await prisma.vehicle.update({ where: { id }, data: toVehicleData(parsed.data) });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: DUPLICATE_ERROR };
    }
    throw e;
  }

  revalidatePath("/admin/taxi-fleet/tech");
  return { ok: true };
}

export async function deleteVehicle(id: string): Promise<ActionResult> {
  const denied = await accessDenied("taxi.tech");
  if (denied) return denied;
  await prisma.vehicle.delete({ where: { id } });
  revalidatePath("/admin/taxi-fleet/tech");
  return { ok: true };
}

export async function listVehicleDocuments(vehicleId: string) {
  await requireSection("taxi.tech", "view");
  return prisma.vehicleDocument.findMany({
    where: { vehicleId },
    orderBy: { uploadedAt: "desc" },
  });
}

export async function uploadVehicleDocument(formData: FormData): Promise<ActionResult> {
  const denied = await accessDenied("taxi.tech");
  if (denied) return denied;

  const vehicleId = String(formData.get("vehicleId") ?? "");
  const file = formData.get("file");

  if (!vehicleId) return { ok: false, error: "Не указан автомобиль" };
  if (!(file instanceof File)) {
    return { ok: false, error: "Файл не выбран" };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, error: "Файл слишком большой (максимум 20 МБ)" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileUrl = await uploadVehicleDocumentFile(vehicleId, buffer, file.name);

  await prisma.vehicleDocument.create({
    data: { vehicleId, fileName: file.name, fileUrl },
  });

  revalidatePath("/admin/taxi-fleet/tech");
  return { ok: true };
}

export async function deleteVehicleDocument(id: string): Promise<ActionResult> {
  const denied = await accessDenied("taxi.tech");
  if (denied) return denied;

  const doc = await prisma.vehicleDocument.findUnique({ where: { id } });
  if (!doc) return { ok: false, error: "Файл не найден" };

  await deleteVehicleDocumentFile(doc.fileUrl);
  await prisma.vehicleDocument.delete({ where: { id } });
  revalidatePath("/admin/taxi-fleet/tech");
  return { ok: true };
}
