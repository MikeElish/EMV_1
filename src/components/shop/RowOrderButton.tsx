"use client";

import { useState } from "react";
import type { Product } from "@prisma/client";
import { useCart } from "@/components/shop/CartProvider";

export function RowOrderButton({ product }: { product: Product }) {
  const { addItem } = useCart();
  const [ordering, setOrdering] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  // "Под заказ" items (stock <= 0) aren't capped by an on-hand count.
  const maxQuantity = product.stock > 0 ? product.stock : 999;

  function handleStart(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    setQuantity(1);
    setOrdering(true);
  }

  function handleConfirm(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    addItem(
      {
        productId: product.id,
        slug: product.slug,
        sku: product.sku,
        name: product.name,
        price: product.price,
      },
      quantity
    );
    setJustAdded(true);
    setTimeout(() => {
      setJustAdded(false);
      setOrdering(false);
    }, 1200);
  }

  if (ordering) {
    return (
      <div onClick={(e) => e.stopPropagation()} className="flex shrink-0 items-center gap-2">
        <div className="flex items-center rounded-md border border-foreground/20">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setQuantity((q) => Math.max(1, q - 1));
            }}
            className="px-2 py-1 text-foreground/60 hover:text-foreground"
            aria-label="Уменьшить количество"
          >
            −
          </button>
          <span className="w-8 text-center text-xs">{quantity}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setQuantity((q) => Math.min(maxQuantity, q + 1));
            }}
            className="px-2 py-1 text-foreground/60 hover:text-foreground"
            aria-label="Увеличить количество"
          >
            +
          </button>
        </div>
        <button
          type="button"
          onClick={handleConfirm}
          className="whitespace-nowrap rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-90"
        >
          {justAdded ? "Добавлено ✓" : "Подтвердить"}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleStart}
      className="shrink-0 whitespace-nowrap rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-90"
    >
      Заказать
    </button>
  );
}
