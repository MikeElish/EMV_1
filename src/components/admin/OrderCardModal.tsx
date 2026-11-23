"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { formatAdminPrice } from "@/lib/money";
import { ORDER_STATUS_LABELS } from "@/lib/validators/orders";
import { DELIVERY_METHOD_LABELS } from "@/lib/delivery";
import { orderLineTotal, formatOrderLineUnitPrice } from "@/lib/order-pricing";
import { PRICE_TIER_LABELS } from "@/lib/pricing";
import { updateOrderPriceTier } from "@/actions/admin/orders";
import type { OrderRow } from "@/components/admin/OrdersTable";
import type { CompanyPriceType } from "@prisma/client";

const PRICE_TYPES: CompanyPriceType[] = ["RETAIL", "WHOLESALE", "DEALER", "TENDER", "INDIVIDUAL"];

function customerOf(order: OrderRow): string {
  if (order.buyerCompany) return order.buyerCompany.name;
  if (order.user?.company) return order.user.company.name;
  if (order.user) {
    const name = [order.user.lastName, order.user.firstName, order.user.patronymic]
      .filter(Boolean)
      .join(" ");
    return name || order.user.login;
  }
  return order.customerName;
}

export function OrderCardModal({
  order,
  managerName,
  onClose,
}: {
  order: OrderRow;
  managerName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const customer = customerOf(order);
  const currentType = order.buyerCompany?.priceType ?? "WHOLESALE";
  const currentMarkup = order.buyerCompany?.individualMarkup ?? 0;
  const [priceType, setPriceType] = useState<CompanyPriceType>(currentType);
  const [markup, setMarkup] = useState<number>(currentMarkup);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function confirm() {
    start(async () => {
      setError(null);
      const result = await updateOrderPriceTier(order.id, priceType, priceType === "INDIVIDUAL" ? markup : undefined);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-4xl" title={`Заказ № ${order.orderNumber}`}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-foreground/50">Покупатель:</span> {customer}
          </div>
          <div>
            <span className="text-foreground/50">Телефон:</span> {order.customerPhone}
          </div>
          {order.customerEmail && (
            <div>
              <span className="text-foreground/50">E-mail:</span> {order.customerEmail}
            </div>
          )}
          <div>
            <span className="text-foreground/50">Дата создания:</span>{" "}
            {new Date(order.createdAt).toLocaleString("ru-RU")}
          </div>
          <div>
            <span className="text-foreground/50">Статус заказа:</span> {ORDER_STATUS_LABELS[order.status]}
          </div>
          <div>
            <span className="text-foreground/50">Оплачен:</span> {order.paid ? "Да" : "Нет"}
          </div>
          {order.deliveryDate && (
            <div>
              <span className="text-foreground/50">Дата доставки:</span>{" "}
              {new Date(order.deliveryDate).toLocaleDateString("ru-RU")}
            </div>
          )}
          {order.deliveryNote && (
            <div className="col-span-2">
              <span className="text-foreground/50">Адрес / примечание:</span> {order.deliveryNote}
            </div>
          )}
          <div>
            <span className="text-foreground/50">Менеджер:</span> {managerName}
          </div>
          <div>
            <span className="text-foreground/50">Итого:</span>{" "}
            <span className="font-semibold">{formatAdminPrice(order.totalAmount)}</span>
          </div>
        </div>

        {order.canEdit && order.buyerCompany && (
          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-foreground/10 p-3">
            <div>
              <label className="block text-xs text-foreground/60">Тип цен</label>
              <select
                value={priceType}
                onChange={(e) => setPriceType(e.target.value as CompanyPriceType)}
                className="mt-1 rounded-md border border-foreground/20 bg-transparent px-2 py-1 text-sm outline-none"
              >
                {PRICE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {PRICE_TIER_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            {priceType === "INDIVIDUAL" && (
              <div>
                <label className="block text-xs text-foreground/60">Наценка, %</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={markup}
                  onChange={(e) => setMarkup(parseFloat(e.target.value) || 0)}
                  className="mt-1 w-28 rounded-md border border-foreground/20 bg-transparent px-2 py-1 text-sm outline-none"
                />
              </div>
            )}
            <button
              type="button"
              disabled={pending || (priceType === currentType && (priceType !== "INDIVIDUAL" || markup === currentMarkup))}
              onClick={confirm}
              className="rounded-md bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              OK
            </button>
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        )}

        <h3 className="border-b border-foreground/10 pb-1 pt-2 text-sm font-semibold">Позиции</h3>
        <table className="w-full text-sm">
          <thead className="text-left text-foreground/50">
            <tr>
              <th className="py-2 pr-4">№</th>
              <th className="py-2 pr-4">Наименование</th>
              <th className="py-2 pr-4">Артикул</th>
              <th className="py-2 pr-4">Кол-во</th>
              <th className="py-2 pr-4">Цена</th>
              <th className="py-2 pr-4">Сумма</th>
              <th className="py-2 pr-4">Статус</th>
              <th className="py-2">Доставка</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, index) => (
              <tr key={item.id} className="border-b border-foreground/10">
                <td className="py-2 pr-4">{index + 1}</td>
                <td className="py-2 pr-4">{item.product?.name ?? item.nameSnapshot}</td>
                <td className="py-2 pr-4">{item.product?.sku ?? "—"}</td>
                <td className="py-2 pr-4">{item.quantity}</td>
                <td className="py-2 pr-4">
                  {item.bonus > 0 ? formatOrderLineUnitPrice(item) : formatAdminPrice(item.priceSnapshot)}
                </td>
                <td className="py-2 pr-4">{formatAdminPrice(orderLineTotal(item))}</td>
                <td className="py-2 pr-4">{ORDER_STATUS_LABELS[item.status]}</td>
                <td className="py-2">
                  {item.deliveryMethod ? DELIVERY_METHOD_LABELS[item.deliveryMethod] : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
