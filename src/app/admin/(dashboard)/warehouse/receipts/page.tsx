import { prisma } from "@/lib/prisma";
import { requireSection } from "@/lib/access-server";
import { getWarehouseData } from "@/lib/onec-warehouse";
import { CrmPage } from "@/components/admin/CrmTableFrame";
import { ReceiptsTable } from "@/components/admin/ReceiptsTable";

export default async function ReceiptsPage() {
  await requireSection("warehouse", "view");
  const [{ warehouses }, receipts] = await Promise.all([
    getWarehouseData(),
    prisma.supplierReceipt.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        supplier: { select: { name: true, inn: true } },
        lines: { select: { purchase: { select: { number: true } }, orderItem: { select: { order: { select: { orderNumber: true } } } } } },
      },
    }),
  ]);
  const warehouseName = new Map(warehouses.map((w) => [w.ref, w.name]));
  return (
    <CrmPage>
      <ReceiptsTable
        warehouses={warehouses}
        receipts={receipts.map((r) => ({
          id: r.id,
          createdAt: r.createdAt.toISOString(),
          supplier: r.supplier.name,
          inn: r.supplier.inn,
          doc: `№ ${r.docNumber} от ${r.docDate.toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" })}`,
          oneCNumber: r.oneCNumber,
          warehouse: warehouseName.get(r.warehouseRef) ?? "—",
          amount: r.amount,
          lines: r.lines.length,
          purchases: [...new Set(r.lines.flatMap((l) => (l.purchase ? [l.purchase.number] : [])))],
          orders: [...new Set(r.lines.flatMap((l) => (l.orderItem ? [l.orderItem.order.orderNumber] : [])))],
          fileName: r.fileName,
          fileUrl: r.fileUrl,
        }))}
      />
    </CrmPage>
  );
}
