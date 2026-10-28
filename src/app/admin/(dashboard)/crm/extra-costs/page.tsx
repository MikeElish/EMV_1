import { prisma } from "@/lib/prisma";
import { requireSection } from "@/lib/access-server";
import { CrmPage } from "@/components/admin/CrmTableFrame";
import { ExtraCostsTable } from "@/components/admin/ExtraCostsTable";

export default async function CrmExtraCostsPage({ searchParams }: PageProps<"/admin/crm/extra-costs">) {
  await requireSection("crm.extra-costs", "view");
  const { number } = await searchParams;
  const costs = await prisma.extraCost.findMany({
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: {
      order: { select: { orderNumber: true } },
      supplier: { select: { name: true, inn: true, kpp: true } },
      lines: { orderBy: { id: "asc" } },
    },
  });
  return (
    <CrmPage>
      <ExtraCostsTable
        initialNumber={typeof number === "string" ? number : undefined}
        costs={costs.map((c) => ({
          id: c.id,
          kind: c.kind,
          number: c.number,
          date: c.date.toLocaleDateString("sv-SE", { timeZone: "Europe/Moscow" }),
          orderId: c.orderId,
          orderNumber: c.order?.orderNumber ?? null,
          supplierId: c.supplierId,
          supplierName: c.supplier?.name ?? null,
          inn: c.supplier?.inn ?? null,
          kpp: c.supplier?.kpp ?? null,
          amount: c.amount,
          status: c.status,
          note: c.note,
          fileName: c.fileName,
          fileUrl: c.fileUrl,
          lines: c.lines.map((l) => ({
            kind: l.kind === "SERVICE" ? "SERVICE" : "GOODS",
            productId: l.productId,
            serviceId: l.serviceId,
            name: l.name,
            quantity: l.quantity,
            price: l.price,
          })),
        }))}
      />
    </CrmPage>
  );
}
