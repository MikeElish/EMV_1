"use server";

import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/session";
import { notifyNewClaim } from "@/lib/claims";
import { CLAIMABLE_STATUSES, CLAIM_REASONS, MAX_CLAIM_PHOTOS } from "@/lib/validators/claims";

export type ClaimResult = { ok: true; number: number } | { ok: false; error: string };

const MAX_PHOTO_SIZE = 10 * 1024 * 1024;

/** «Возврат / рекламация» in «Мои заказы»: a shipped line, how many, why, photos. */
export async function createClaim(formData: FormData): Promise<ClaimResult> {
  const session = await getAdminSession();
  if (!session?.userId || session.role !== "CUSTOMER") return { ok: false, error: "Требуется вход в аккаунт" };

  const itemId = String(formData.get("orderItemId") ?? "");
  const item = await prisma.orderItem.findUnique({
    where: { id: itemId },
    include: { order: { select: { id: true, userId: true } }, claims: { where: { status: { not: "Отклонена" } }, select: { quantity: true } } },
  });
  if (!item || item.order.userId !== session.userId) return { ok: false, error: "Позиция не найдена" };
  if (!(CLAIMABLE_STATUSES as readonly string[]).includes(item.status)) {
    return { ok: false, error: "Заявку можно оформить на отгруженную позицию" };
  }

  const reason = String(formData.get("reason") ?? "");
  if (!(CLAIM_REASONS as readonly string[]).includes(reason)) return { ok: false, error: "Выберите причину" };
  const description = String(formData.get("description") ?? "").trim();
  if (description.length < 5) return { ok: false, error: "Опишите, что случилось" };
  const quantity = Math.floor(Number(formData.get("quantity")));
  const left = item.quantity - item.claims.reduce((s, c) => s + c.quantity, 0);
  if (!(quantity >= 1) || quantity > left) return { ok: false, error: `Количество — от 1 до ${left}` };

  const photos = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (photos.length > MAX_CLAIM_PHOTOS) return { ok: false, error: `Не больше ${MAX_CLAIM_PHOTOS} фото` };
  if (photos.some((f) => !f.type.startsWith("image/") || f.size > MAX_PHOTO_SIZE)) {
    return { ok: false, error: "Фото — изображения до 10 МБ" };
  }

  const claim = await prisma.claim.create({
    data: { orderId: item.order.id, orderItemId: item.id, userId: session.userId, quantity, reason, description: description.slice(0, 3000), photos: [] },
  });
  if (photos.length) {
    const dir = path.join(process.cwd(), "public", "uploads", "claims", claim.id);
    await mkdir(dir, { recursive: true });
    const urls: string[] = [];
    for (const f of photos) {
      const name = `${Date.now()}-${crypto.randomUUID()}${path.extname(f.name).toLowerCase() || ".jpg"}`;
      await writeFile(path.join(dir, name), Buffer.from(await f.arrayBuffer()));
      urls.push(`/uploads/claims/${claim.id}/${name}`);
    }
    await prisma.claim.update({ where: { id: claim.id }, data: { photos: urls } });
  }
  await notifyNewClaim(claim.id).catch((error) => console.error("[claims] letter", error));
  revalidatePath("/shop/orders");
  revalidatePath("/admin/crm/claims");
  return { ok: true, number: claim.number };
}
