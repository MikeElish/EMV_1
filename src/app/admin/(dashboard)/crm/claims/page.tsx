import { prisma } from "@/lib/prisma";
import { requireSection } from "@/lib/access-server";
import { CrmPage } from "@/components/admin/CrmTableFrame";
import { ClaimsTable } from "@/components/admin/ClaimsTable";

export default async function CrmClaimsPage() {
  await requireSection("crm.claims", "view");
  const claims = await prisma.claim.findMany({
    orderBy: { number: "desc" },
    include: {
      order: { select: { orderNumber: true, customerName: true, customerEmail: true } },
      orderItem: { select: { nameSnapshot: true, priceSnapshot: true, product: { select: { sku: true } } } },
    },
  });
  return (
    <CrmPage>
      <ClaimsTable
        claims={claims.map((c) => ({
          id: c.id,
          number: c.number,
          createdAt: c.createdAt.toISOString(),
          orderNumber: c.order.orderNumber,
          customer: c.order.customerName,
          email: c.order.customerEmail,
          name: c.orderItem.nameSnapshot,
          sku: c.orderItem.product?.sku ?? null,
          quantity: c.quantity,
          price: c.orderItem.priceSnapshot,
          reason: c.reason,
          description: c.description,
          photos: c.photos,
          status: c.status,
          resolution: c.resolution,
          answer: c.answer,
          supplierClaimAt: c.supplierClaimAt?.toISOString() ?? null,
        }))}
      />
    </CrmPage>
  );
}
