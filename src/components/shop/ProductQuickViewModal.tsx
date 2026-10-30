"use client";

import type { Product } from "@prisma/client";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { OfferPrice, ProductOffersBlock } from "@/components/shop/ShopOffers";
import { ProductGallery } from "@/components/shop/ProductGallery";
import { Modal } from "@/components/Modal";

type Attributes = { machineType?: string; compatibleWith?: string[] } | null;

export function ProductQuickViewModal({
  product,
  onRequestClose,
}: {
  product: Product;
  onRequestClose: () => void;
}) {
  const attributes = product.attributes as Attributes;

  return (
    <Modal
      onClose={onRequestClose}
      title={`Товар: ${product.name}`}
      widthClassName="w-[90vw] max-sm:w-[95vw]"
      maxWidthClassName="max-w-[60vw] max-sm:max-w-[95vw]"
      maxHeightClassName="max-h-[60vh]"
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <ProductGallery images={product.images} alt={product.name} />

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
            <OfferPrice product={product} />
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
          <ProductOffersBlock product={product} />

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
    </Modal>
  );
}
