import { PrismaClient } from "@prisma/client";
import { buildProductSlug } from "@/lib/slug";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

const PREFIX_RE = /^(VOE|VO)[0-9]+$/i;
const LEADING_NON_DIGITS = /^[^0-9]+/;

function numericSku(sku: string): string {
  return sku.replace(LEADING_NON_DIGITS, "");
}

function offerKey(o: {
  supplierId: string | null;
  price: number;
  quality: string | null;
  deliveryDays: number | null;
  warehouse: string | null;
}): string {
  return [o.supplierId ?? "", o.price, o.quality ?? "", o.deliveryDays ?? "", o.warehouse ?? ""].join("|");
}

async function mergeProducts(srcId: string, targetId: string, originalSrcSku: string) {
  if (dryRun) return;
  await prisma.$transaction(async (tx) => {
    const src = await tx.product.findUnique({
      where: { id: srcId },
      include: { pricing: true, offers: true, partnerStocks: true, oneCLinks: true, priceRequestLines: true },
    });
    const target = await tx.product.findUnique({
      where: { id: targetId },
      include: { pricing: true, offers: true, partnerStocks: true },
    });
    if (!src || !target) throw new Error("Product not found");

    const newName = target.name.includes(`(${originalSrcSku})`) ? target.name : `${target.name} (${originalSrcSku})`;
    const newSlug = buildProductSlug("Volvo", target.sku);

    await tx.product.update({
      where: { id: target.id },
      data: { brand: "Volvo", name: newName, slug: newSlug },
    });

    // SupplierOffer: дубликаты по ключу удаляем, остальные переносим
    const targetOfferKeys = new Set(target.offers.map(offerKey));
    for (const o of src.offers) {
      const key = offerKey(o);
      if (targetOfferKeys.has(key)) {
        await tx.supplierOffer.delete({ where: { id: o.id } });
      } else {
        await tx.supplierOffer.update({ where: { id: o.id }, data: { productId: target.id } });
        targetOfferKeys.add(key);
      }
    }

    // PartnerStock: объединяем по (supplierId, sku)
    const targetStockMap = new Map(target.partnerStocks.map((s) => [`${s.supplierId}|${target.sku}`, s]));
    for (const s of src.partnerStocks) {
      const key = `${s.supplierId}|${target.sku}`;
      const existing = targetStockMap.get(key);
      if (existing) {
        const q1 = existing.quantity ?? 0;
        const q2 = s.quantity ?? 0;
        const newQty = q1 + q2;
        const price = existing.price ?? s.price ?? 0;
        await tx.partnerStock.update({
          where: { id: existing.id },
          data: {
            quantity: newQty,
            total: price && newQty ? price * newQty : existing.total,
            price: price || existing.price,
          },
        });
        await tx.partnerStock.delete({ where: { id: s.id } });
      } else {
        await tx.partnerStock.update({
          where: { id: s.id },
          data: { productId: target.id, sku: target.sku },
        });
        targetStockMap.set(key, s);
      }
    }

    // ProductPricing: если у целевого нет цены закупки, копируем из источника
    if ((!target.pricing || target.pricing.purchasePrice <= 0) && src.pricing && src.pricing.purchasePrice > 0) {
      await tx.productPricing.upsert({
        where: { productId: target.id },
        update: {
          purchasePrice: src.pricing.purchasePrice,
          retailPrice: src.pricing.retailPrice,
          dealerPrice: src.pricing.dealerPrice,
          supplierId: src.pricing.supplierId,
        },
        create: {
          productId: target.id,
          purchasePrice: src.pricing.purchasePrice,
          retailPrice: src.pricing.retailPrice,
          dealerPrice: src.pricing.dealerPrice,
          supplierId: src.pricing.supplierId,
        },
      });
    }
    await tx.productPricing.deleteMany({ where: { productId: src.id } });

    // Простые связи
    await tx.orderItem.updateMany({ where: { productId: src.id }, data: { productId: target.id } });
    await tx.supplierOrderLine.updateMany({ where: { productId: src.id }, data: { productId: target.id } });
    await tx.extraCostLine.updateMany({ where: { productId: src.id }, data: { productId: target.id } });
    await tx.repairLine.updateMany({ where: { productId: src.id }, data: { productId: target.id } });
    await tx.searchLog.updateMany({ where: { productId: src.id }, data: { productId: target.id } });

    // PriceRequestLine: пропускаем при конфликте
    for (const r of src.priceRequestLines) {
      const exists = await tx.priceRequestLine.findUnique({
        where: { requestId_productId: { requestId: r.requestId, productId: target.id } },
      });
      if (!exists) {
        await tx.priceRequestLine.update({
          where: { requestId_productId: { requestId: r.requestId, productId: src.id } },
          data: { productId: target.id },
        });
      } else {
        await tx.priceRequestLine.delete({ where: { requestId_productId: { requestId: r.requestId, productId: src.id } } });
      }
    }

    // OneCProductLink: пропускаем при конфликте ref
    for (const l of src.oneCLinks) {
      const existing = await tx.oneCProductLink.findUnique({ where: { ref: l.ref } });
      if (!existing) {
        await tx.oneCProductLink.update({ where: { ref: l.ref }, data: { productId: target.id } });
      } else if (existing.productId === target.id) {
        await tx.oneCProductLink.delete({ where: { ref: l.ref } });
      }
    }

    await tx.product.delete({ where: { id: src.id } });
  });
}

async function normalizeProduct(productId: string, newSku: string, originalSku: string) {
  if (dryRun) return;
  const newSlug = buildProductSlug("Volvo", newSku);
  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: productId },
      data: {
        sku: newSku,
        brand: "Volvo",
        name: `${(await tx.product.findUnique({ where: { id: productId }, select: { name: true } }))?.name ?? ""} (${originalSku})`,
        slug: newSlug,
      },
    });
    await tx.partnerStock.updateMany({ where: { productId }, data: { sku: newSku } });
  });
}

async function main() {
  const candidates = await prisma.product.findMany({
    where: { sku: { startsWith: "VO" } },
    orderBy: { sku: "asc" },
  });

  const prefixed = candidates.filter((p) => PREFIX_RE.test(p.sku));
  let merged = 0;
  let normalized = 0;
  let skipped = 0;

  for (const src of prefixed) {
    const digits = numericSku(src.sku);
    const numeric = await prisma.product.findUnique({ where: { sku: digits } });

    if (numeric) {
      if (dryRun) {
        console.log(`[DRY-RUN] merge ${src.sku} -> ${numeric.sku} (target id ${numeric.id})`);
      } else {
        await mergeProducts(src.id, numeric.id, src.sku);
        console.log(`merged ${src.sku} -> ${numeric.sku}`);
      }
      merged++;
    } else {
      const slugConflict = await prisma.product.findUnique({ where: { slug: buildProductSlug("Volvo", digits) } });
      if (slugConflict) {
        console.log(`SKIP ${src.sku}: slug conflict for ${buildProductSlug("Volvo", digits)}`);
        skipped++;
        continue;
      }
      if (dryRun) {
        console.log(`[DRY-RUN] normalize ${src.sku} -> ${digits}`);
      } else {
        await normalizeProduct(src.id, digits, src.sku);
        console.log(`normalized ${src.sku} -> ${digits}`);
      }
      normalized++;
    }
  }

  console.log(`\nTotal prefixed: ${prefixed.length}`);
  console.log(`Merged: ${merged}`);
  console.log(`Normalized: ${normalized}`);
  console.log(`Skipped: ${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
