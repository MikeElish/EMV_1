"use client";

import { useEffect, useState } from "react";
import type { Product } from "@prisma/client";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { OfferPrice, ProductOffersBlock } from "@/components/shop/ShopOffers";
import { ProductGallery } from "@/components/shop/ProductGallery";
import { ProductAvailabilityText } from "@/components/shop/StockBadge";
import { Modal } from "@/components/Modal";
import type { ShopCatalogProduct } from "@/lib/shop-types";

type Attributes = { machineType?: string; compatibleWith?: string[] } | null;

export function ProductQuickViewModal({
  product,
  onRequestClose,
}: {
  product: Product | ShopCatalogProduct;
  onRequestClose: () => void;
}) {
  const [fullProduct, setFullProduct] = useState<Product | null>(null);
  const isFullProduct = "description" in product;

  useEffect(() => {
    if (isFullProduct) return;
    let cancelled = false;
    fetch(`/api/shop/product/${encodeURIComponent(product.slug)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Product | null) => {
        if (!cancelled) setFullProduct(data);
      })
      .catch(() => {
        // Keep showing the lightweight data if the fetch fails.
      });
    return () => {
      cancelled = true;
    };
  }, [product.slug, isFullProduct]);

  const p = fullProduct ?? product;
  const attributes = ("attributes" in p ? (p.attributes as Attributes) : null);
  const images = "images" in p ? (p.images as string[]) : [];
  const description = "description" in p ? (p.description as string | null) : null;

  return (
    <Modal
      onClose={onRequestClose}
      title={`Товар: ${p.name}`}
      widthClassName="w-[90vw] max-sm:w-[95vw]"
      maxWidthClassName="max-w-[60vw] max-sm:max-w-[95vw]"
      maxHeightClassName="max-h-[60vh]"
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <ProductGallery images={images} alt={p.name} />

        <div>
          {p.brand && (
            <span className="text-sm text-foreground/50">
              {p.brand}
              {attributes?.machineType ? ` · ${attributes.machineType}` : ""}
            </span>
          )}
          <h2 className="mt-1 text-xl font-bold">{p.name}</h2>
          <p className="mt-1 text-sm text-foreground/40">Артикул: {p.sku}</p>

          <p className="mt-4 text-2xl font-semibold">
            <OfferPrice product={p} />
          </p>
          <p className="mt-1 text-sm">
            <ProductAvailabilityText product={p} size="sm" />
          </p>

          <AddToCartButton
            product={{
              id: p.id,
              slug: p.slug,
              sku: p.sku,
              name: p.name,
              price: p.price,
              stock: p.stock,
              partnerStock: p.partnerStock,
            }}
          />
          <ProductOffersBlock product={p} />

          {description && <p className="mt-4 text-sm text-foreground/80">{description}</p>}

          {attributes?.compatibleWith && attributes.compatibleWith.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-foreground/50">Совместимо с</h3>
              <ul className="mt-1 text-sm">
                {attributes.compatibleWith.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
