"use client";

import { useState } from "react";
import { useCart } from "@/components/shop/CartProvider";

export function AddToCartButton({
  product,
}: {
  product: {
    id: string;
    slug: string;
    sku: string;
    name: string;
    price: number;
    stock: number;
  };
}) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  // "Под заказ" items (stock <= 0) aren't capped by an on-hand count.
  const maxQuantity = product.stock > 0 ? product.stock : 999;

  function handleAdd() {
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
    setTimeout(() => setJustAdded(false), 1500);
  }

  return (
    <div className="mt-6 flex items-center gap-3">
      <div className="flex items-center rounded-md border border-foreground/20">
        <button
          type="button"
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          className="px-3 py-2 text-foreground/60 hover:text-foreground"
          aria-label="Уменьшить количество"
        >
          −
        </button>
        <span className="w-8 text-center text-sm">{quantity}</span>
        <button
          type="button"
          onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
          className="px-3 py-2 text-foreground/60 hover:text-foreground"
          aria-label="Увеличить количество"
        >
          +
        </button>
      </div>
      <button
        type="button"
        onClick={handleAdd}
        className="flex-1 rounded-md bg-foreground px-6 py-2 font-medium text-background transition-opacity hover:opacity-90"
      >
        {justAdded ? "Добавлено ✓" : "Добавить в корзину"}
      </button>
    </div>
  );
}
