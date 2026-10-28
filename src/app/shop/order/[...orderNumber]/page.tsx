import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatRub, formatShopPrice } from "@/lib/money";
import { ORDER_STATUS_LABELS } from "@/lib/validators/orders";
import { payableLines, sbpAvailable } from "@/lib/sbp";
import { SbpPayButton } from "@/components/shop/SbpPayButton";

export default async function OrderConfirmationPage({
  params,
  searchParams,
}: PageProps<"/shop/order/[...orderNumber]">) {
  const { payment } = await searchParams;
  // Order numbers contain a literal "/" (ДДММГГ/N), so this route is a
  // catch-all: the segments are rejoined into the exact orderNumber string.
  const { orderNumber: segments } = await params;
  const orderNumber = segments.join("/");

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { items: true },
  });

  if (!order) notFound();
  // A private customer pays the lines «Требуется оплата» by СБП.
  const due = (await sbpAvailable()) ? await payableLines(order.id) : null;
  const returnedPaymentId = typeof payment === "string" ? payment : undefined;

  return (
    <section className="mx-auto max-w-2xl px-4 sm:px-6 py-16">
      <h1 className="text-2xl font-bold">Спасибо за заказ!</h1>
      <p className="mt-2 text-foreground/70">
        Номер заказа: <span className="font-medium">{order.orderNumber}</span>
      </p>
      <p className="mt-1 text-foreground/70">
        Статус: {ORDER_STATUS_LABELS[order.status] ?? order.status}
      </p>

      <div className="mt-8 rounded-lg border border-foreground/10 p-4 text-sm">
        {order.items.map((item) => (
          <div key={item.id} className="flex justify-between py-1">
            <span>
              {item.nameSnapshot} × {item.quantity}
            </span>
            <span>{formatShopPrice(item.priceSnapshot * item.quantity)}</span>
          </div>
        ))}
        <div className="mt-2 flex justify-between border-t border-foreground/10 pt-2 font-semibold">
          <span>Итого</span>
          <span>{formatRub(order.totalAmount)}</span>
        </div>
        {order.items.some((i) => i.priceSnapshot <= 0) && (
          <p className="mt-2 text-foreground/60">
            Позиции «По запросу» в сумму не входят: менеджер уточнит цену и пришлёт счёт.
          </p>
        )}
      </div>

      {(due || returnedPaymentId) && (
        <SbpPayButton orderNumber={order.orderNumber} amount={due?.amount ?? null} returnedPaymentId={returnedPaymentId} />
      )}

      <Link
        href="/shop"
        className="mt-8 inline-block text-sm underline underline-offset-4"
      >
        ← Продолжить покупки
      </Link>
    </section>
  );
}
