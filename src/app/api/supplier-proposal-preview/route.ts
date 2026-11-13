import { prisma } from "@/lib/prisma";
import { requireSection } from "@/lib/access-server";
import { supplierQuoteWorkbook } from "@/lib/supplier-quote-sheet";
import type { SupplierQuoteRow } from "@/lib/supplier-quote";

export const runtime = "nodejs";

export async function GET(request: Request) {
  await requireSection("crm.supplier-orders", "view");
  const orderNumber = new URL(request.url).searchParams.get("orderNumber")?.trim() ?? "";
  if (!orderNumber || orderNumber.length > 100) return Response.json({ error: "Укажите номер заказа" }, { status: 400 });
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: {
      items: {
        where: { cancelled: false },
        orderBy: { id: "asc" },
        select: { productId: true, quantity: true, product: { select: { brand: true, sku: true, name: true } } },
      },
    },
  });
  if (!order) return Response.json({ error: "Заказ не найден" }, { status: 404 });
  const rows: SupplierQuoteRow[] = order.items.map((item) => ({
    productId: item.productId,
    brand: item.product.brand,
    sku: item.product.sku,
    name: item.product.name,
    quantity: item.quantity,
    price: null,
    currency: "RUB",
    exchangeRate: null,
    logisticsMarkupPercent: 0,
    noOffer: false,
    inStock: false,
    stockQuantity: null,
    quality: "",
    warehouse: "",
    deliveryDays: "",
  }));
  const file = await supplierQuoteWorkbook(rows);
  const filename = `Предпросмотр-${orderNumber.replace(/[^a-zA-Z0-9_-]/g, "-")}.xlsx`;
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
