import { prisma } from "@/lib/prisma";
import { requireSection } from "@/lib/access-server";
import { OneCError } from "@/lib/onec";
import { getWarehouseData } from "@/lib/onec-warehouse";
import { CrmPage } from "@/components/admin/CrmTableFrame";
import { ReceiptsTable } from "@/components/admin/ReceiptsTable";

async function loadReceipts() {
  try {
    const [data, receiptRows] = await Promise.all([
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
    return { ok: true as const, warehouses: data.warehouses, receipts: receiptRows };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof OneCError ? error.message : "1С не ответила — поступления недоступны, попробуйте позже.",
    };
  }
}

export default async function ReceiptsPage() {
  await requireSection("warehouse.receipts", "view");
  const loaded = await loadReceipts();
  if (!loaded.ok) return <p className="text-sm text-red-600">{loaded.error}</p>;
  const { warehouses, receipts } = loaded;
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
