import { prisma } from "@/lib/prisma";
import { requireSection } from "@/lib/access-server";
import { CrmPage } from "@/components/admin/CrmTableFrame";
import { HandoverTable } from "@/components/admin/HandoverTable";

const DAY = 24 * 60 * 60 * 1000;

const monthAgo = () => new Date(Date.now() - 30 * DAY);

export default async function HandoverPage() {
  await requireSection("warehouse", "view");
  // Ready to hand over, and what was handed over in the last month.
  const orders = await prisma.order.findMany({
    where: { OR: [{ items: { some: { status: "READY_TO_SHIP" } } }, { handoverAt: { gte: monthAgo() } }] },
    orderBy: { createdAt: "asc" },
    include: {
      items: { select: { status: true, quantity: true, priceSnapshot: true, paid: true, deferred: true, product: { select: { brand: true, name: true, sku: true } } } },
      documents: { where: { category: "WAYBILL" }, select: { id: true, fileName: true, fileUrl: true } },
    },
  });
  return (
    <CrmPage>
      <HandoverTable
        orders={orders.map((o) => {
          const ready = o.items.filter((i) => i.status === "READY_TO_SHIP");
          return {
            id: o.id,
            orderNumber: o.orderNumber,
            customer: o.customerName,
            phone: o.customerPhone,
            delivery: o.deliveryNote,
            ready: ready.map((i) => ({ name: [i.product.brand, i.product.name, i.product.sku].filter(Boolean).join(" "), quantity: i.quantity })),
            readySum: ready.reduce((s, i) => s + i.priceSnapshot * i.quantity, 0),
            linesTotal: o.items.filter((i) => i.status !== "CANCELLED").length,
            payment: ready.every((i) => i.paid) ? "Оплачено" : ready.every((i) => i.paid || i.deferred) ? "Отсрочка" : "Не оплачено",
            handover: o.handover,
            handoverAt: o.handoverAt?.toISOString() ?? null,
            handoverNote: o.handoverNote,
            waybills: o.documents,
          };
        })}
      />
    </CrmPage>
  );
}
