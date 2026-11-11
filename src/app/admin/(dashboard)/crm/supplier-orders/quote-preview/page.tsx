import type { Metadata } from "next";
import { CrmPage } from "@/components/admin/CrmTableFrame";
import { SupplierProposalForm } from "@/components/supplier/SupplierProposalForm";
import { requireSection } from "@/lib/access-server";
import { prisma } from "@/lib/prisma";
import type { SupplierQuoteRow } from "@/lib/supplier-quote";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Предпросмотр запроса КП", robots: { index: false, follow: false } };

export default async function SupplierQuotePreviewPage({
  searchParams,
}: PageProps<"/admin/crm/supplier-orders/quote-preview">) {
  await requireSection("crm.supplier-orders", "view");
  const query = await searchParams;
  const orderNumber = typeof query.orderNumber === "string" ? query.orderNumber.trim() : "";
  const order = orderNumber
    ? await prisma.order.findUnique({
        where: { orderNumber },
        select: {
          orderNumber: true,
          items: {
            where: { cancelled: false },
            orderBy: { id: "asc" },
            select: { productId: true, quantity: true, product: { select: { sku: true, name: true } } },
          },
        },
      })
    : null;

  if (!order) {
    return (
      <CrmPage>
        <p className="text-sm text-red-600">Заказ не найден. Укажите номер в параметре orderNumber.</p>
      </CrmPage>
    );
  }

  const rows: SupplierQuoteRow[] = order.items.map((item) => ({
    productId: item.productId,
    sku: item.product.sku,
    name: item.product.name,
    quantity: item.quantity,
    price: null,
    currency: "RUB",
    exchangeRate: null,
    logisticsMarkupPercent: 0,
    noOffer: false,
    quality: "",
    warehouse: "",
    deliveryDays: "",
  }));

  return (
    <CrmPage>
      <header className="mb-6">
        <p className="text-sm text-foreground/50">Тестовый просмотр — данные заказа настоящие, отправка и сохранение отключены</p>
        <h1 className="mt-1 text-2xl font-semibold">Запрос № {order.orderNumber}</h1>
      </header>
      <SupplierProposalForm
        rows={rows}
        previewOrderNumber={order.orderNumber}
        templateUrl={`/api/supplier-proposal-preview?orderNumber=${encodeURIComponent(order.orderNumber)}`}
      />
    </CrmPage>
  );
}
