import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

/** Makes `offerId` the product's selected offer (the one behind the site prices). */
export async function selectOffer(db: Db, productId: string, offerId: string) {
  await db.supplierOffer.updateMany({ where: { productId, NOT: { id: offerId } }, data: { selected: false } });
  return db.supplierOffer.update({ where: { id: offerId }, data: { selected: true } });
}

/**
 * A price for the product from this supplier (an import, later Проценка):
 * updates that supplier's offer or adds one, and selects it.
 */
export async function recordOffer(
  db: Db,
  productId: string,
  offer: { supplierId: string | null; price: number; deliveryDays?: number | null; quality?: string | null }
) {
  const existing = await db.supplierOffer.findFirst({
    where: { productId, supplierId: offer.supplierId },
    orderBy: { updatedAt: "desc" },
  });
  const data = {
    price: offer.price,
    ...(offer.deliveryDays !== undefined ? { deliveryDays: offer.deliveryDays } : {}),
    ...(offer.quality !== undefined ? { quality: offer.quality } : {}),
  };
  const saved = existing
    ? await db.supplierOffer.update({ where: { id: existing.id }, data })
    : await db.supplierOffer.create({ data: { productId, supplierId: offer.supplierId, ...data } });
  return selectOffer(db, productId, saved.id);
}
