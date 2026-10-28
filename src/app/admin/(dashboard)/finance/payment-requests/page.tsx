import { prisma } from "@/lib/prisma";
import { requireSection } from "@/lib/access-server";
import { CrmPage } from "@/components/admin/CrmTableFrame";
import { PaymentRequestsTable } from "@/components/admin/PaymentRequestsTable";

export default async function PaymentRequestsPage() {
  await requireSection("finance.payment-requests", "view");
  const requests = await prisma.paymentRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      company: { select: { name: true, inn: true } },
      order: { select: { orderNumber: true } },
      purchase: { select: { number: true } },
      extraCost: { select: { kind: true } },
      bankTransaction: { select: { date: true, documentNumber: true } },
      files: { orderBy: { createdAt: "asc" } },
    },
  });
  return (
    <CrmPage>
      <PaymentRequestsTable
        requests={requests.map((r) => ({
          id: r.id,
          number: r.number,
          createdAt: r.createdAt.toISOString(),
          companyId: r.companyId,
          companyName: r.company?.name ?? null,
          inn: r.company?.inn || r.inn,
          orderId: r.orderId,
          orderNumber: r.order?.orderNumber ?? null,
          source: r.purchase ? `Заказ поставщику № ${r.purchase.number}` : r.extraCost ? `Доп.расход: ${r.extraCost.kind}` : null,
          amount: r.amount,
          purpose: r.purpose,
          status: r.status,
          paidAt: r.paidAt?.toISOString() ?? null,
          payment: r.bankTransaction
            ? `п/п${r.bankTransaction.documentNumber ? ` № ${r.bankTransaction.documentNumber}` : ""} от ${r.bankTransaction.date.toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" })}`
            : null,
          files: r.files.map((f) => ({ id: f.id, kind: f.kind, fileName: f.fileName, fileUrl: f.fileUrl })),
        }))}
      />
    </CrmPage>
  );
}
