"use client";

import { useState } from "react";
import Link from "next/link";
import type { Product } from "@prisma/client";
import { formatRub } from "@/lib/money";
import { useCart } from "@/components/shop/CartProvider";
import { ProductQuickViewModal } from "@/components/shop/ProductQuickViewModal";
import { ProtectedImage } from "@/components/shop/ProtectedImage";

type Attributes = { machineType?: string } | null;

function StockBadge({ stock }: { stock: number }) {
  return stock > 0 ? (
    <span className="whitespace-nowrap text-xs text-green-700 dark:text-green-500">
      В наличии
    </span>
  ) : (
    <span className="whitespace-nowrap text-xs text-foreground/40">
      Под заказ
    </span>
  );
}

function ProductListRow({ product }: { product: Product }) {
  const { addItem } = useCart();
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const [showQtyInput, setShowQtyInput] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  function handleOrderClick() {
    if (!showQtyInput) {
      setShowQtyInput(true);
      return;
    }
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
    setShowQtyInput(false);
    setQuantity(1);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  }

  return (
    <>
      <div className="flex items-center gap-4 rounded-lg border border-foreground/10 p-3">
        <button
          type="button"
          onClick={() => setQuickViewOpen(true)}
          className="w-24 shrink-0 text-left text-xs text-foreground/50 hover:underline"
        >
          {product.sku}
        </button>
        <button
          type="button"
          onClick={() => setQuickViewOpen(true)}
          className="min-w-0 flex-1 truncate text-left font-medium hover:underline"
        >
          {product.name}
        </button>
        <StockBadge stock={product.stock} />
        <span className="w-28 shrink-0 text-right font-semibold">
          {formatRub(product.price)}
        </span>

        <div className="flex shrink-0 items-center gap-2">
          {showQtyInput && (
            <div className="flex items-center rounded-md border border-foreground/20">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="px-2 py-1 text-foreground/60 hover:text-foreground"
                aria-label="Уменьшить количество"
              >
                −
              </button>
              <span className="w-6 text-center text-sm">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(999, q + 1))}
                className="px-2 py-1 text-foreground/60 hover:text-foreground"
                aria-label="Увеличить количество"
              >
                +
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={handleOrderClick}
            className="whitespace-nowrap rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            {justAdded ? "Добавлено ✓" : "Заказать"}
          </button>
        </div>
      </div>

      {quickViewOpen && (
        <ProductQuickViewModal
          product={product}
          onRequestClose={() => setQuickViewOpen(false)}
        />
      )}
    </>
  );
}

export function ProductCard({
  product,
  layout = "grid",
}: {
  product: Product;
  layout?: "grid" | "list";
}) {
  const attributes = product.attributes as Attributes;

  if (layout === "list") {
    return <ProductListRow product={product} />;
  }

  return (
    <Link
      href={`/shop/product/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-foreground/10 transition-colors hover:border-foreground/30"
    >
      <div className="flex aspect-square items-center justify-center bg-foreground/[0.03] text-xs text-foreground/30">
        {product.images.length > 0 ? (
          <ProtectedImage
            src={product.images[0]}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          "Фото скоро"
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        {product.brand && (
          <span className="text-xs text-foreground/50">
            {product.brand}
            {attributes?.machineType ? ` · ${attributes.machineType}` : ""}
          </span>
        )}
        <h3 className="font-medium leading-snug group-hover:underline">
          {product.name}
        </h3>
        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="font-semibold">{formatRub(product.price)}</span>
          <StockBadge stock={product.stock} />
        </div>
      </div>
    </Link>
  );
}
