"use client";

import { useEffect, useState } from "react";
import type { Product } from "@prisma/client";
import { ProductCard } from "@/components/shop/ProductCard";

type Layout = "grid" | "list";

const STORAGE_KEY = "emv-shop-layout";

function GridIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
      <rect x="2" y="2" width="7" height="7" rx="1" />
      <rect x="11" y="2" width="7" height="7" rx="1" />
      <rect x="2" y="11" width="7" height="7" rx="1" />
      <rect x="11" y="11" width="7" height="7" rx="1" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
      <rect x="2" y="3" width="16" height="3" rx="1" />
      <rect x="2" y="8.5" width="16" height="3" rx="1" />
      <rect x="2" y="14" width="16" height="3" rx="1" />
    </svg>
  );
}

export function ProductGrid({
  products,
  title,
}: {
  products: Product[];
  title?: string;
}) {
  const [layout, setLayout] = useState<Layout>("grid");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "grid" || stored === "list") setLayout(stored);
    } catch {
      // ignore unavailable storage
    }
  }, []);

  function changeLayout(next: Layout) {
    setLayout(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore storage write failures
    }
  }

  return (
    <div>
      <div className={`mb-4 flex items-center gap-1 ${title ? "justify-between" : "justify-end"}`}>
        {title && <h2 className="text-xl font-semibold">{title}</h2>}
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => changeLayout("grid")}
            aria-pressed={layout === "grid"}
            aria-label="Сетка"
            className={`rounded-md border p-2 transition-colors ${
              layout === "grid"
                ? "border-foreground/30 bg-foreground/5"
                : "border-transparent text-foreground/40 hover:text-foreground"
            }`}
          >
            <GridIcon />
          </button>
          <button
            type="button"
            onClick={() => changeLayout("list")}
            aria-pressed={layout === "list"}
            aria-label="Список"
            className={`rounded-md border p-2 transition-colors ${
              layout === "list"
                ? "border-foreground/30 bg-foreground/5"
                : "border-transparent text-foreground/40 hover:text-foreground"
            }`}
          >
            <ListIcon />
          </button>
        </div>
      </div>

      {layout === "grid" ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} layout="grid" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} layout="list" />
          ))}
        </div>
      )}
    </div>
  );
}
