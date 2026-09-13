"use client";

import { useEffect, useState } from "react";
import type { Product } from "@prisma/client";
import { formatRub } from "@/lib/money";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { ProtectedImage } from "@/components/shop/ProtectedImage";

const TRANSITION_MS = 200;

type Attributes = { machineType?: string; compatibleWith?: string[] } | null;

export function ProductQuickViewModal({
  product,
  onRequestClose,
}: {
  product: Product;
  onRequestClose: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const attributes = product.attributes as Attributes;

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  function close() {
    setVisible(false);
    setTimeout(onRequestClose, TRANSITION_MS);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      onClick={close}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6 transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[60vh] w-[90vw] max-w-[60vw] flex-col overflow-y-auto rounded-lg bg-background p-6 shadow-xl transition-all duration-200 max-sm:w-[95vw] max-sm:max-w-[95vw] ${
          visible ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Закрыть"
          className="ml-auto text-foreground/40 hover:text-foreground"
        >
          ✕
        </button>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-foreground/[0.03] text-sm text-foreground/30">
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

          <div>
            {product.brand && (
              <span className="text-sm text-foreground/50">
                {product.brand}
                {attributes?.machineType ? ` · ${attributes.machineType}` : ""}
              </span>
            )}
            <h2 className="mt-1 text-xl font-bold">{product.name}</h2>
            <p className="mt-1 text-sm text-foreground/40">
              Артикул: {product.sku}
            </p>

            <p className="mt-4 text-2xl font-semibold">
              {formatRub(product.price)}
            </p>
            <p className="mt-1 text-sm">
              {product.stock > 0 ? (
                <span className="text-green-700 dark:text-green-500">
                  В наличии ({product.stock} шт.)
                </span>
              ) : (
                <span className="text-foreground/50">Под заказ</span>
              )}
            </p>

            <AddToCartButton
              product={{
                id: product.id,
                slug: product.slug,
                sku: product.sku,
                name: product.name,
                price: product.price,
                stock: product.stock,
              }}
            />

            {product.description && (
              <p className="mt-4 text-sm text-foreground/80">
                {product.description}
              </p>
            )}

            {attributes?.compatibleWith && attributes.compatibleWith.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-foreground/50">
                  Совместимо с
                </h3>
                <ul className="mt-1 text-sm">
                  {attributes.compatibleWith.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
