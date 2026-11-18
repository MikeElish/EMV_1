"use client";

import { Modal } from "@/components/Modal";
import { formatAdminPrice } from "@/lib/money";
import { SUPPLIER_ORDER_STATUS_LABELS } from "@/lib/validators/supplier-orders";
import { formatSupplierCurrency } from "@/lib/supplier-currency";
import { DocumentFileLink } from "@/components/admin/DocumentFileLink";
import type { SupplierOrderRow } from "@/components/admin/SupplierOrdersTable";

const FILE_KINDS: Record<string, string> = { INVOICE: "Счёт", PAYMENT: "Платёжка", OTHER: "Файл" };

export function SupplierOrderCardModal({
  row,
  onClose,
}: {
  row: SupplierOrderRow;
  onClose: () => void;
}) {
  const title = row.forStock
    ? "Позиция на склад"
    : row.buyerOrderNumber
      ? `Заказ покупателя № ${row.buyerOrderNumber}`
      : row.orderNumber
        ? `Заказ покупателя № ${row.orderNumber}`
        : "Позиция заказа поставщику";

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-4xl" title={title}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div>
            <span className="text-foreground/50">Наименование:</span> {row.name}
          </div>
          <div>
            <span className="text-foreground/50">Артикул:</span> {row.sku}
          </div>
          <div>
            <span className="text-foreground/50">Бренд:</span> {row.brand ?? "—"}
          </div>
          <div>
            <span className="text-foreground/50">Категория:</span> {row.category}
          </div>
          <div>
            <span className="text-foreground/50">Количество:</span> {row.quantity}
          </div>
          <div>
            <span className="text-foreground/50">Поставщик:</span> {row.supplier ?? "—"}
          </div>
          <div>
            <span className="text-foreground/50">Цена закупки:</span>{" "}
            <span className="font-medium">{formatAdminPrice(row.price)}</span>
            {row.currency !== "RUB" && (
              <span className="ml-2 text-foreground/60">{formatSupplierCurrency(row.quotedPrice, row.currency)}</span>
            )}
          </div>
          <div>
            <span className="text-foreground/50">Срок поставки:</span>{" "}
            {row.deliveryDays === null ? "—" : `${row.deliveryDays} дн.`}
          </div>
          <div>
            <span className="text-foreground/50">Качество:</span> {row.quality ?? "—"}
          </div>
          <div>
            <span className="text-foreground/50">Статус:</span> {SUPPLIER_ORDER_STATUS_LABELS[row.status]}
          </div>
          <div>
            <span className="text-foreground/50">№ заказа поставщику:</span> {row.purchaseNumber ?? "—"}
          </div>
          <div>
            <span className="text-foreground/50">Дата поставки:</span>{" "}
            {row.deliveryDate ? new Date(row.deliveryDate).toLocaleDateString("ru-RU") : "—"}
          </div>
        </div>

        {row.files.length > 0 && (
          <>
            <h3 className="border-b border-foreground/10 pb-1 pt-2 text-sm font-semibold">Файлы</h3>
            <ul className="space-y-1 text-sm">
              {row.files.map((f) => (
                <li key={f.fileUrl}>
                  {FILE_KINDS[f.kind] ?? "Файл"}:{" "}
                  <DocumentFileLink
                    fileUrl={f.fileUrl}
                    fileName={f.fileName}
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  />
                </li>
              ))}
            </ul>
          </>
        )}

        {row.offerOptions.length > 0 && (
          <>
            <h3 className="border-b border-foreground/10 pb-1 pt-2 text-sm font-semibold">Предложения поставщиков</h3>
            <table className="w-full text-sm">
              <thead className="text-left text-foreground/50">
                <tr>
                  <th className="py-2 pr-4">Поставщик</th>
                  <th className="py-2 pr-4">Цена поставщика</th>
                  <th className="py-2 pr-4">Цена в рублях</th>
                </tr>
              </thead>
              <tbody>
                {row.offerOptions.map((option) => (
                  <tr key={option.id} className="border-b border-foreground/10">
                    <td className="py-2 pr-4">{option.supplierName}</td>
                    <td className="py-2 pr-4">{formatSupplierCurrency(option.quotedPrice, option.currency)}</td>
                    <td className="py-2 pr-4">{formatAdminPrice(option.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </Modal>
  );
}
