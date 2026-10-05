"use server";

import { revalidatePath } from "next/cache";
import { FuelType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { accessDenied } from "@/lib/access-server";
import { uploadFuelReceiptFile, deleteFuelReceiptFile } from "@/lib/fuel-receipt-storage";
import { VAT_RATES } from "@/lib/fuel";

export type ActionResult = { ok: true } | { ok: false; error: string };

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_FILE = /\.(pdf|jpe?g|png|heic|webp|gif)$/i;

const num = (value: FormDataEntryValue | null) => Number(String(value ?? "").replace(",", ".").replace(/\s/g, ""));

/** Новая заправка: one receipt with its scan (required). */
export async function createFuelReceipt(formData: FormData): Promise<ActionResult> {
  const denied = await accessDenied("taxi.fuel");
  if (denied) return denied;

  const date = new Date(String(formData.get("date") ?? ""));
  const driverName = String(formData.get("driverName") ?? "").trim();
  const vehicleId = String(formData.get("vehicleId") ?? "");
  const fuelType = String(formData.get("fuelType") ?? "") as FuelType;
  const liters = num(formData.get("liters"));
  const price = num(formData.get("pricePerLiter"));
  const vatRaw = String(formData.get("vatRate") ?? "");
  const vatRate = vatRaw === "none" ? null : Number(vatRaw);
  const stationInn = String(formData.get("stationInn") ?? "").replace(/\s/g, "");
  const stationName = String(formData.get("stationName") ?? "").trim();
  const file = formData.get("file");

  if (Number.isNaN(date.getTime())) return { ok: false, error: "Укажите дату" };
  if (driverName.length < 2) return { ok: false, error: "Укажите водителя" };
  if (!Object.values(FuelType).includes(fuelType)) return { ok: false, error: "Выберите топливо" };
  if (!(liters > 0) || liters > 2000) return { ok: false, error: "Укажите количество литров" };
  if (!(price > 0) || price > 10000) return { ok: false, error: "Укажите стоимость за 1 л" };
  if (!VAT_RATES.includes(vatRate)) return { ok: false, error: "Выберите ставку НДС" };
  if (!/^(\d{10}|\d{12})$/.test(stationInn)) return { ok: false, error: "ИНН АЗС — 10 или 12 цифр" };
  if (stationName.length < 2) return { ok: false, error: "Укажите наименование АЗС" };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Приложите чек (файл обязателен)" };
  if (file.size > MAX_FILE_SIZE) return { ok: false, error: "Файл слишком большой (максимум 20 МБ)" };
  if (!ALLOWED_FILE.test(file.name)) return { ok: false, error: "Чек: PDF или изображение (JPG, PNG, HEIC, WEBP)" };

  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { id: true } });
  if (!vehicle) return { ok: false, error: "Выберите машину" };

  const pricePerLiter = Math.round(price * 100);
  const fileUrl = await uploadFuelReceiptFile(Buffer.from(await file.arrayBuffer()), file.name);
  await prisma.fuelReceipt.create({
    data: {
      date,
      driverName,
      vehicleId,
      fuelType,
      liters: Math.round(liters * 100) / 100,
      pricePerLiter,
      totalAmount: Math.round(liters * pricePerLiter),
      vatRate,
      stationInn,
      stationName,
      fileName: file.name,
      fileUrl,
    },
  });
  revalidatePath("/admin/taxi-fleet/fuel");
  return { ok: true };
}

export async function deleteFuelReceipt(id: string): Promise<ActionResult> {
  const denied = await accessDenied("taxi.fuel");
  if (denied) return denied;
  const receipt = await prisma.fuelReceipt.findUnique({ where: { id } });
  if (!receipt) return { ok: false, error: "Запись не найдена" };
  await prisma.fuelReceipt.delete({ where: { id } });
  await deleteFuelReceiptFile(receipt.fileUrl);
  revalidatePath("/admin/taxi-fleet/fuel");
  return { ok: true };
}
