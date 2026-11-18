"use client";

import { useState } from "react";
import Link from "next/link";
import { DropdownMenu } from "@/components/DropdownMenu";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { ProductCardModal } from "@/components/admin/ProductCardModal";
import { deleteProduct } from "@/actions/admin/products";
import type { ProductRow } from "@/components/admin/ProductsTable";

export function ProductActionsMenu({
  product,
  canEdit,
  onRememberPlace,
}: {
  product: ProductRow;
  canEdit: boolean;
  onRememberPlace: () => void;
}) {
  const [showCard, setShowCard] = useState(false);

  return (
    <>
      <DropdownMenu
        label="Действие"
        buttonClassName="rounded-md border border-foreground/20 bg-foreground/5 px-2 py-1 text-xs transition-opacity hover:opacity-80"
      >
        {(close) => (
          <>
            {canEdit && (
              <Link
                href={`/admin/crm/products/${product.id}/edit`}
                onClick={() => {
                  close();
                  onRememberPlace();
                }}
                className="block px-3 py-2 hover:bg-foreground/5"
              >
                Изменить
              </Link>
            )}
            <button
              type="button"
              onClick={() => {
                close();
                setShowCard(true);
              }}
              className="block w-full px-3 py-2 text-left hover:bg-foreground/5"
            >
              Карточка
            </button>
            {canEdit && (
              <DeleteButton
                action={deleteProduct.bind(null, product.id)}
                confirmText={`Удалить товар «${product.name}»?`}
                variant="menu"
              />
            )}
          </>
        )}
      </DropdownMenu>

      {showCard && <ProductCardModal product={product} onClose={() => setShowCard(false)} />}
    </>
  );
}
