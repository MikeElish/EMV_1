import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatRubPrecise } from "@/lib/money";
import { CrmPage, CrmTableScroll, STICKY_THEAD } from "@/components/admin/CrmTableFrame";
import { SupplierOrderDeleteButton } from "@/components/admin/SupplierOrderDeleteButton";

// What has to be bought: «Заказать» in Проценка and customer order lines
// that aren't in stock. The full workflow of this tab comes later.
export default async function CrmSupplierOrdersPage() {
  const lines = await prisma.supplierOrderLine.findMany({
    include: {
      product: { select: { id: true, brand: true, name: true, sku: true } },
      supplier: { select: { name: true } },
      orderItem: { select: { order: { select: { orderNumber: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <CrmPage>
      <h1 className="shrink-0 text-lg font-semibold">Заказ поставщику</h1>
      <p className="mt-1 shrink-0 text-sm text-foreground/50">
        Позиции из «Проценки» (кнопка «Заказать») и заказы покупателей на товар не из наличия.
      </p>
      {lines.length === 0 ? (
        <p className="mt-6 text-sm text-foreground/40">Пока пусто.</p>
      ) : (
        <CrmTableScroll>
          <table className="w-full text-sm">
            <thead className={STICKY_THEAD}>
              <tr className="text-left text-foreground/50">
                <th className="py-2 pr-4">Дата</th>
                <th className="py-2 pr-4">Поставщик</th>
                <th className="py-2 pr-4">Бренд</th>
                <th className="py-2 pr-4">Наименование</th>
                <th className="py-2 pr-4">Артикул</th>
                <th className="py-2 pr-4">Кол-во</th>
                <th className="py-2 pr-4">Цена</th>
                <th className="py-2 pr-4">Сумма</th>
                <th className="py-2 pr-4">Срок</th>
                <th className="py-2 pr-4">Заказ покупателя</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id} className="border-b border-foreground/10">
                  <td className="whitespace-nowrap py-2 pr-4 text-foreground/60">
                    {l.createdAt.toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" })}
                  </td>
                  <td className="py-2 pr-4">{l.supplier?.name ?? <span className="text-foreground/40">не выбран</span>}</td>
                  <td className="py-2 pr-4 text-foreground/70">{l.product.brand ?? "—"}</td>
                  <td className="py-2 pr-4">
                    <Link
                      href={`/admin/crm/price-check?product=${l.product.id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {l.product.name}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap py-2 pr-4">{l.product.sku}</td>
                  <td className="py-2 pr-4">{l.quantity}</td>
                  <td className="whitespace-nowrap py-2 pr-4">{l.price ? formatRubPrecise(l.price) : "—"}</td>
                  <td className="whitespace-nowrap py-2 pr-4 font-medium">
                    {l.price ? formatRubPrecise(l.price * l.quantity) : "—"}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-4">{l.deliveryDays === null ? "—" : `${l.deliveryDays} дн.`}</td>
                  <td className="whitespace-nowrap py-2 pr-4">
                    {l.orderItem ? (
                      <Link
                        href={`/admin/crm/orders?orderNumber=${encodeURIComponent(l.orderItem.order.orderNumber)}`}
                        className="underline underline-offset-4"
                      >
                        {l.orderItem.order.orderNumber}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2 text-right">
                    <SupplierOrderDeleteButton id={l.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CrmTableScroll>
      )}
    </CrmPage>
  );
}
