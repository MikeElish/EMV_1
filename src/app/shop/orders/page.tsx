import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { CustomerOrdersTable } from "@/components/shop/CustomerOrdersTable";
import type { LatestDocs } from "@/components/shop/OrderActionMenu";
import { ORDER_DOCUMENT_CATEGORY_LABELS } from "@/lib/validators/orders";
import type { OrderDocumentCategory } from "@prisma/client";

const DOCUMENT_CATEGORIES = Object.keys(
  ORDER_DOCUMENT_CATEGORY_LABELS
) as OrderDocumentCategory[];

export default async function MyOrdersPage() {
  const session = await getAdminSession();
  if (!session?.userId || session.role !== "CUSTOMER") {
    redirect("/crm");
  }

  const orders = await prisma.order.findMany({
    where: { userId: session.userId },
    include: {
      items: { include: { product: { select: { sku: true } } } },
      documents: { orderBy: { uploadedAt: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  const ordersWithLatestDocs = orders.map((order) => {
    const latestDocs = Object.fromEntries(
      DOCUMENT_CATEGORIES.map((category) => {
        const doc = order.documents.find((d) => d.category === category);
        return [category, doc ? { fileUrl: doc.fileUrl, fileName: doc.fileName } : null];
      })
    ) as LatestDocs;
    return { ...order, latestDocs };
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-bold">Мои заказы</h1>
      <div className="mt-6 overflow-x-auto">
        <CustomerOrdersTable orders={ordersWithLatestDocs} />
      </div>
    </div>
  );
}
