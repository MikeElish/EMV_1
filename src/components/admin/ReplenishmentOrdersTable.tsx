"use client";

import { useState } from "react";
import { formatRub } from "@/lib/money";
import { ORDER_STATUS_LABELS } from "@/lib/validators/orders";
import { SUPPLIER_ORDER_STATUS_LABELS } from "@/lib/validators/supplier-orders";
import { formatSupplierCurrency, parseSupplierCurrency } from "@/lib/supplier-currency";
import { CrmTableScroll, STICKY_THEAD } from "@/components/admin/CrmTableFrame";
import { NewOrderModal } from "@/components/admin/NewOrderModal";
import type { OrderStatus, SupplierOrderStatus } from "@prisma/client";

type ReplenishmentOrder = {
  id: string;
  orderNumber: string;
  createdAt: Date;
  items: {
    id: string;
    nameSnapshot: string;
    quantity: number;
    priceSnapshot: number;
    status: OrderStatus;
    product: { sku: string } | null;
  }[];
};

type SupplierStockLine = {
  id: string;
  createdAt: Date;
  quantity: number;
  price: number;
  quotedPrice: number | null;
  currency: string;
  status: SupplierOrderStatus;
  product: { name: string; sku: string };
  supplier: { name: string } | null;
  purchase: { number: number } | null;
};

export function ReplenishmentOrdersTable({
  orders,
  supplierLines,
  canCreate,
}: {
  orders: ReplenishmentOrder[];
  supplierLines: SupplierStockLine[];
  canCreate: boolean;
}) {
  const [creating, setCreating] = useState(false);

  return (
    <>
      <div className="flex shrink-0 items-center gap-3">
        {canCreate && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            aria-label="Создать пополнение остатков"
            className="flex h-8 w-8 items-center justify-center rounded-md bg-green-600 text-lg font-bold leading-none text-white transition-opacity hover:opacity-90"
          >
            +
          </button>
        )}
        <h1 className="text-lg font-semibold">Пополнение остатков</h1>
      </div>

      {creating && <NewOrderModal mode="replenishment" onClose={() => setCreating(false)} />}

      <CrmTableScroll>
        <table className="w-full border-collapse text-sm">
          <thead className={STICKY_THEAD}>
            <tr className="text-left text-foreground/60">
              <th className="px-3 py-2 font-normal">Заказ</th>
              <th className="px-3 py-2 font-normal">Дата</th>
              <th className="px-3 py-2 font-normal">Товар</th>
              <th className="px-3 py-2 font-normal">Артикул</th>
              <th className="px-3 py-2 text-right font-normal">Количество</th>
              <th className="px-3 py-2 text-right font-normal">Цена</th>
              <th className="px-3 py-2 text-right font-normal">Сумма</th>
              <th className="px-3 py-2 font-normal">Статус</th>
            </tr>
          </thead>
          <tbody>
            {orders.flatMap((order) =>
              order.items.map((item) => (
                <tr key={`${order.id}:${item.id}`} className="border-b border-foreground/5">
                  <td className="whitespace-nowrap px-3 py-2">{order.orderNumber}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {order.createdAt.toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" })}
                  </td>
                  <td className="px-3 py-2">{item.nameSnapshot}</td>
                  <td className="px-3 py-2">{item.product?.sku ?? "—"}</td>
                  <td className="px-3 py-2 text-right">{item.quantity}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">{formatRub(item.priceSnapshot)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">{formatRub(item.priceSnapshot * item.quantity)}</td>
                  <td className="whitespace-nowrap px-3 py-2">{ORDER_STATUS_LABELS[item.status]}</td>
                </tr>
              ))
            )}
            {orders.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-foreground/40">
                  Заказов на пополнение пока нет.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </CrmTableScroll>

      <section className="mt-8 min-h-0">
        <h2 className="mb-3 text-base font-semibold">Закупки на склад</h2>
        <CrmTableScroll>
          <table className="w-full border-collapse text-sm">
            <thead className={STICKY_THEAD}>
              <tr className="text-left text-foreground/60">
                <th className="px-3 py-2 font-normal">Заказ поставщику</th>
                <th className="px-3 py-2 font-normal">Дата</th>
                <th className="px-3 py-2 font-normal">Поставщик</th>
                <th className="px-3 py-2 font-normal">Товар</th>
                <th className="px-3 py-2 font-normal">Артикул</th>
                <th className="px-3 py-2 text-right font-normal">Количество</th>
                <th className="px-3 py-2 text-right font-normal">Цена</th>
                <th className="px-3 py-2 text-right font-normal">Сумма</th>
                <th className="px-3 py-2 font-normal">Статус</th>
              </tr>
            </thead>
            <tbody>
              {supplierLines.map((line) => (
                <tr key={line.id} className="border-b border-foreground/5">
                  <td className="whitespace-nowrap px-3 py-2">{line.purchase ? `№ ${line.purchase.number}` : "Не отправлен"}</td>
                  <td className="whitespace-nowrap px-3 py-2">{line.createdAt.toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" })}</td>
                  <td className="px-3 py-2">{line.supplier?.name ?? "—"}</td>
                  <td className="px-3 py-2">{line.product.name}</td>
                  <td className="whitespace-nowrap px-3 py-2">{line.product.sku}</td>
                  <td className="px-3 py-2 text-right">{line.quantity}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {formatRub(line.price)}
                    {line.currency !== "RUB" && (
                      <div className="text-xs text-foreground/60">
                        {formatSupplierCurrency(line.quotedPrice ?? line.price, parseSupplierCurrency(line.currency) ?? "RUB")}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {formatRub(line.price * line.quantity)}
                    {line.currency !== "RUB" && (
                      <div className="text-xs text-foreground/60">
                        {formatSupplierCurrency((line.quotedPrice ?? line.price) * line.quantity, parseSupplierCurrency(line.currency) ?? "RUB")}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{SUPPLIER_ORDER_STATUS_LABELS[line.status]}</td>
                </tr>
              ))}
              {supplierLines.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-foreground/40">Закупок на склад пока нет.</td>
                </tr>
              )}
            </tbody>
          </table>
        </CrmTableScroll>
      </section>
    </>
  );
}
