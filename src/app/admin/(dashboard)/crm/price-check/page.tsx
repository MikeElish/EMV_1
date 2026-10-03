import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CrmPage, CrmTableScroll, STICKY_THEAD } from "@/components/admin/CrmTableFrame";

// Lines in "Проверка заказа": ordered without enough stock. The price-check
// workflow itself comes later; for now this is the list to work through.
export default async function CrmPriceCheckPage() {
  const lines = await prisma.orderItem.findMany({
    where: { status: "CHECKING" },
    include: {
      product: { select: { id: true, sku: true, brand: true, stock: true } },
      order: {
        select: {
          orderNumber: true,
          createdAt: true,
          customerName: true,
          user: { select: { company: { select: { name: true } } } },
        },
      },
    },
    orderBy: { order: { createdAt: "asc" } },
  });

  return (
    <CrmPage>
      <h1 className="shrink-0 text-lg font-semibold">Проценка</h1>
      <p className="mt-1 shrink-0 text-sm text-foreground/50">
        Позиции заказов в статусе «Проверка заказа» — товара нет в наличии в нужном количестве.
      </p>
      {lines.length === 0 ? (
        <p className="mt-6 text-sm text-foreground/40">Нет позиций на проверке.</p>
      ) : (
        <CrmTableScroll>
          <table className="w-full text-sm">
            <thead className={STICKY_THEAD}>
              <tr className="text-left text-foreground/50">
                <th className="py-2 pr-4">Дата</th>
                <th className="py-2 pr-4">Заказ</th>
                <th className="py-2 pr-4">Заказчик</th>
                <th className="py-2 pr-4">Товар</th>
                <th className="py-2 pr-4">Артикул</th>
                <th className="py-2 pr-4">Бренд</th>
                <th className="py-2 pr-4">Заказано</th>
                <th className="py-2 pr-4">В наличии</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} className="border-b border-foreground/10">
                  <td className="py-2 pr-4 text-foreground/60">
                    {line.order.createdAt.toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" })}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-4">
                    <Link
                      href={`/admin/crm/orders?orderNumber=${encodeURIComponent(line.order.orderNumber)}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {line.order.orderNumber}
                    </Link>
                  </td>
                  <td className="py-2 pr-4">{line.order.user?.company?.name ?? line.order.customerName}</td>
                  <td className="py-2 pr-4">{line.nameSnapshot}</td>
                  <td className="py-2 pr-4">{line.product.sku}</td>
                  <td className="py-2 pr-4 text-foreground/60">{line.product.brand ?? "—"}</td>
                  <td className="py-2 pr-4">{line.quantity}</td>
                  <td className="py-2 pr-4">{line.product.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CrmTableScroll>
      )}
    </CrmPage>
  );
}
