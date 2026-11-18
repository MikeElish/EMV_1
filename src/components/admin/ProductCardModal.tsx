"use client";

import Link from "next/link";
import { Modal } from "@/components/Modal";
import { formatAdminPrice } from "@/lib/money";
import type { ProductRow } from "@/components/admin/ProductsTable";

export function ProductCardModal({
  product,
  onClose,
}: {
  product: ProductRow;
  onClose: () => void;
}) {
  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-2xl" title={product.name}>
      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <div>
            <span className="text-foreground/50">Артикул:</span> {product.sku}
          </div>
          <div>
            <span className="text-foreground/50">Бренд:</span> {product.brand ?? "—"}
          </div>
          <div>
            <span className="text-foreground/50">Категория:</span> {product.category.name}
          </div>
          <div>
            <span className="text-foreground/50">Поставщик:</span> {product.pricing?.supplier?.name ?? "—"}
          </div>
          <div>
            <span className="text-foreground/50">Закупка:</span> {product.pricing?.purchasePrice === undefined ? "—" : formatAdminPrice(product.pricing.purchasePrice)}
          </div>
          <div>
            <span className="text-foreground/50">Розница:</span> {product.pricing?.retailPrice === undefined ? "—" : formatAdminPrice(product.pricing.retailPrice)}
          </div>
          <div>
            <span className="text-foreground/50">Опт:</span> {formatAdminPrice(product.price)}
          </div>
          <div>
            <span className="text-foreground/50">Дилер:</span> {product.pricing?.dealerPrice === undefined ? "—" : formatAdminPrice(product.pricing.dealerPrice)}
          </div>
          <div>
            <span className="text-foreground/50">Остаток:</span> {product.stock}
          </div>
          <div>
            <span className="text-foreground/50">Активен:</span> {product.isActive ? "Да" : "Нет"}
          </div>
        </div>
        {product.description && (
          <div>
            <span className="text-foreground/50">Описание:</span>
            <p className="mt-1 whitespace-pre-line">{product.description}</p>
          </div>
        )}
        <div className="pt-2">
          <Link
            href={`/admin/crm/products/${product.id}/edit`}
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            Открыть карточку для редактирования
          </Link>
        </div>
      </div>
    </Modal>
  );
}
