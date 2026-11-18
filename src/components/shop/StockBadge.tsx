"use client";

type StockProduct = {
  stock: number;
  partnerStock: number;
};

export function StockBadge({ product, size = "xs" }: { product: StockProduct; size?: "xs" | "sm" }) {
  const sizeClass = size === "sm" ? "text-sm" : "text-xs";
  if (product.stock > 0) {
    return (
      <span className={`whitespace-nowrap ${sizeClass} text-green-700 dark:text-green-500`}>
        В наличии
      </span>
    );
  }
  if (product.partnerStock > 0) {
    return (
      <span className={`whitespace-nowrap ${sizeClass} text-green-700 dark:text-green-500`}>
        В наличии
        <span className="block">партнёрская сеть</span>
      </span>
    );
  }
  return (
    <span className={`whitespace-nowrap ${sizeClass} text-foreground/40`}>
      Под заказ
    </span>
  );
}

export function ProductAvailabilityText({ product, size = "sm" }: { product: StockProduct & { name?: string }; size?: "xs" | "sm" }) {
  const sizeClass = size === "sm" ? "text-sm" : "text-xs";
  if (product.stock > 0) {
    return (
      <span className={`${sizeClass} text-green-700 dark:text-green-500`}>
        В наличии ({product.stock} шт.)
      </span>
    );
  }
  if (product.partnerStock > 0) {
    return (
      <span className={`${sizeClass} text-green-700 dark:text-green-500`}>
        В наличии
        <span className="block">партнёрская сеть</span>
      </span>
    );
  }
  return <span className={`${sizeClass} text-foreground/50`}>Под заказ</span>;
}
