import { prisma } from "@/lib/prisma";
import { CrmPage } from "@/components/admin/CrmTableFrame";
import { SupplierOrdersTable } from "@/components/admin/SupplierOrdersTable";

// What has to be bought: «Заказать» in Проценка and customer order lines
// that aren't in stock. Its statuses drive the customer lines in Заказы.
export default async function CrmSupplierOrdersPage() {
  const lines = await prisma.supplierOrderLine.findMany({
    include: {
      product: { select: { id: true, brand: true, name: true, sku: true, category: { select: { name: true } } } },
      supplier: { select: { name: true } },
      orderItem: { select: { order: { select: { orderNumber: true } } } },
      purchase: { select: { number: true, sentAt: true, invoiceAt: true, files: { select: { kind: true, fileName: true, fileUrl: true }, orderBy: { createdAt: "asc" } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <CrmPage>
      <SupplierOrdersTable
        rows={lines.map((l) => ({
          id: l.id,
          orderNumber: l.orderItem?.order.orderNumber ?? null,
          productId: l.product.id,
          brand: l.product.brand,
          name: l.product.name,
          sku: l.product.sku,
          category: l.product.category.name,
          quantity: l.quantity,
          supplier: l.supplier?.name ?? null,
          deliveryDays: l.deliveryDays,
          quality: l.quality,
          status: l.status,
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
