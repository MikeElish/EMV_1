import { prisma } from "@/lib/prisma";
import { CrmPage } from "@/components/admin/CrmTableFrame";
import { SupplierOrdersTable } from "@/components/admin/SupplierOrdersTable";
import { getMyAccess } from "@/lib/access-server";
import { priceWithSupplierLogistics } from "@/lib/supplier-pricing";
import { parseSupplierCurrency } from "@/lib/supplier-currency";

// What has to be bought: «Заказать» in Проценка and customer order lines
// that aren't in stock. Its statuses drive the customer lines in Заказы.
export default async function CrmSupplierOrdersPage() {
  const [lines, me, siteSettings] = await Promise.all([
    prisma.supplierOrderLine.findMany({
    include: {
      product: { select: { id: true, brand: true, name: true, sku: true, category: { select: { name: true } } } },
      supplier: { select: { name: true } },
      orderItem: { select: { order: { select: { orderNumber: true, managerId: true } } } },
      purchase: { select: { number: true, sentAt: true, invoiceAt: true, files: { select: { kind: true, fileName: true, fileUrl: true }, orderBy: { createdAt: "asc" } } } },
    },
    orderBy: { createdAt: "desc" },
    }),
    getMyAccess(),
    prisma.siteSettings.findUnique({ where: { id: 1 }, select: { manualInputEnabled: true } }),
  ]);
  const offers = await prisma.supplierOffer.findMany({
    where: {
      productId: { in: [...new Set(lines.map((line) => line.productId))] },
      supplierId: { not: null },
      noOffer: false,
      price: { gt: 0 },
      supplier: { is: { isOwn: false } },
    },
    include: { supplier: { select: { id: true, name: true, supplierProfile: { select: { logisticsMarkupPercent: true } } } } },
    orderBy: [{ priceUpdatedAt: "desc" }, { createdAt: "desc" }],
  });
  const offersByProduct = new Map<string, typeof offers>();
  for (const offer of offers) {
    offersByProduct.set(offer.productId, [...(offersByProduct.get(offer.productId) ?? []), offer]);
  }
  const manualOrderNumbers = [...new Set(lines.map((line) => line.buyerOrderNumber).filter((value): value is string => !!value))];
  const manualOrders = manualOrderNumbers.length
    ? await prisma.order.findMany({
        where: { orderNumber: { in: manualOrderNumbers } },
        select: { orderNumber: true, managerId: true },
      })
    : [];
  const managerByOrderNumber = new Map(manualOrders.map((order) => [order.orderNumber, order.managerId]));

  return (
    <CrmPage>
      <SupplierOrdersTable
        manualInputEnabled={me?.role === "OWNER" && siteSettings?.manualInputEnabled === true}
        canDelete={me?.role === "OWNER"}
        rows={lines.map((l) => ({
          id: l.id,
          canEdit:
            me?.role === "OWNER" ||
            (l.orderItem?.order.managerId ?? managerByOrderNumber.get(l.buyerOrderNumber ?? "") ?? null) === me?.userId,
          orderNumber: l.orderItem?.order.orderNumber ?? null,
          buyerOrderNumber: l.buyerOrderNumber,
          forStock: l.forStock,
          productId: l.product.id,
          brand: l.product.brand,
          name: l.product.name,
          sku: l.product.sku,
          category: l.product.category.name,
          quantity: l.quantity,
          price: l.price,
          quotedPrice: l.quotedPrice ?? l.price,
          currency: parseSupplierCurrency(l.currency) ?? "RUB",
          supplierId: l.supplierId,
          supplier: l.supplier?.name ?? null,
          offerId: l.offerId,
          purchaseId: l.purchaseId,
          offerOptions: (() => {
            const productOffers = offersByProduct.get(l.productId) ?? [];
            const bySupplier = new Map<string, (typeof productOffers)[number]>();
            for (const offer of productOffers) {
              if (offer.supplierId && offer.supplier) bySupplier.set(offer.supplierId, offer);
            }
            const currentOffer = l.offerId ? productOffers.find((offer) => offer.id === l.offerId) : null;
            if (currentOffer?.supplierId) bySupplier.set(currentOffer.supplierId, currentOffer);
            return [...bySupplier.values()].map((offer) => {
              const markup = offer.supplier?.supplierProfile?.logisticsMarkupPercent ?? 0;
              const currency = parseSupplierCurrency(offer.currency) ?? "RUB";
              return {
                id: offer.id,
                supplierId: offer.supplierId!,
                supplierName: offer.supplier!.name,
                price: currency === "RUB" ? priceWithSupplierLogistics(offer.price, markup) : offer.price,
                quotedPrice: offer.quotedPrice ?? offer.price,
                currency,
              };
            });
          })(),
          deliveryDays: l.deliveryDays,
          quality: l.quality,
          status: l.status,
          noOffer: l.noOffer,
          purchaseNumber: l.purchase?.number ?? null,
          sentAt: l.purchase?.sentAt?.toISOString() ?? null,
          // Planned: from the letter (or, not sent yet, from today) plus the supplier's term.
          deliveryDate:
            l.deliveryDays == null
              ? null
              : new Date((l.purchase?.sentAt ?? new Date()).getTime() + l.deliveryDays * 24 * 60 * 60 * 1000).toISOString(),
          files: l.purchase?.files ?? [],
        }))}
      />
    </CrmPage>
  );
}
