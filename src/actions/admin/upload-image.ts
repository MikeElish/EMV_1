"use server";

import { verifyAdminSession } from "@/lib/admin-dal";
import { applyWatermark } from "@/lib/watermark";
import { uploadWatermarkedImage, deleteImage } from "@/lib/image-storage";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export type UploadImageResult = { ok: true; url: string } | { ok: false; error: string };

export async function uploadProductImage(formData: FormData): Promise<UploadImageResult> {
  await verifyAdminSession();

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "Файл не выбран" };
  }
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "Файл должен быть изображением" };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, error: "Файл слишком большой (максимум 10 МБ)" };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const watermarked = await applyWatermark(buffer);
    const url = await uploadWatermarkedImage(watermarked, `${crypto.randomUUID()}.jpg`);
    return { ok: true, url };
  } catch {
    return { ok: false, error: "Не удалось обработать изображение" };
  }
}

export async function removeProductImage(url: string): Promise<void> {
  await verifyAdminSession();
  await deleteImage(url);
}
