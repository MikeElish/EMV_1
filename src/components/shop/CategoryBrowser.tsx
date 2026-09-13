"use client";

import { useEffect, useMemo, useRef, useState, type WheelEvent } from "react";
import type { Product } from "@prisma/client";
import { formatRub } from "@/lib/money";
import { ProductQuickViewModal } from "@/components/shop/ProductQuickViewModal";
import { RowOrderButton } from "@/components/shop/RowOrderButton";
import { BRANDS } from "@/content/brands";

export type BrowserCategory = {
  id: string;
  name: string;
  slug: string;
  count: number;
};

const ROW_HEIGHT = 52; // px -- two lines (name + sku)
const VISIBLE_PRODUCT_ROWS = 10;
const PRODUCT_AREA_HEIGHT = ROW_HEIGHT * VISIBLE_PRODUCT_ROWS;

// Design target for a category card's height -- the actual visible count is
// derived from this so the category frame always fills exactly the same
// height as the product list frame (see cardHeight/visibleCount below).
const NOMINAL_CARD_HEIGHT = 76;

type SortOption = "default" | "price_asc" | "price_desc" | "name_asc" | "name_desc" | "sku";

const SORT_COMPARATORS: Record<Exclude<SortOption, "default">, (a: Product, b: Product) => number> = {
  price_asc: (a, b) => a.price - b.price,
  price_desc: (a, b) => b.price - a.price,
  name_asc: (a, b) => a.name.localeCompare(b.name, "ru"),
  name_desc: (a, b) => b.name.localeCompare(a.name, "ru"),
  sku: (a, b) => a.sku.localeCompare(b.sku, undefined, { numeric: true, sensitivity: "base" }),
};

const SORT_LABELS: Record<SortOption, string> = {
  default: "По умолчанию",
  price_asc: "Дешевле",
  price_desc: "Дороже",
  name_asc: "А-Я",
  name_desc: "Я-А",
  sku: "Артикул",
};
const SORT_OPTIONS = Object.keys(SORT_LABELS) as SortOption[];

export function CategoryBrowser({
  categories,
  products,
}: {
  categories: BrowserCategory[];
  products: Product[];
}) {
  const [scrollIndex, setScrollIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("default");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  const [brand, setBrand] = useState<string | null>(null);
  const [brandQuery, setBrandQuery] = useState("");
  const [brandMenuOpen, setBrandMenuOpen] = useState(false);
  const brandMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sortMenuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setSortMenuOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setSortMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [sortMenuOpen]);

  useEffect(() => {
    if (!brandMenuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (brandMenuRef.current && !brandMenuRef.current.contains(e.target as Node)) {
        setBrandMenuOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setBrandMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [brandMenuOpen]);

  function selectBrand(next: string | null) {
    setBrand(next);
    setBrandQuery(next ?? "");
    setBrandMenuOpen(false);
  }

  const brandOptions = useMemo(() => {
    const q = brandQuery.trim().toLowerCase();
    if (!q || q === (brand ?? "").toLowerCase()) return BRANDS;
    return BRANDS.filter((b) => b.toLowerCase().includes(q));
  }, [brandQuery, brand]);

  const visibleCount = Math.max(
    1,
    Math.min(categories.length || 1, Math.round(PRODUCT_AREA_HEIGHT / NOMINAL_CARD_HEIGHT))
  );
  const cardHeight = PRODUCT_AREA_HEIGHT / visibleCount;

  const maxScrollIndex = Math.max(0, categories.length - visibleCount);

  function scrollBy(delta: number) {
    setScrollIndex((i) => Math.min(maxScrollIndex, Math.max(0, i + delta)));
  }

  function handleWheel(e: WheelEvent<HTMLDivElement>) {
    if (categories.length <= visibleCount) return;
    e.preventDefault();
    scrollBy(e.deltaY > 0 ? 1 : -1);
  }

  // A selected card that scrolls out of the visible window loses its
  // selection -- matches how the drum only "knows about" what's on screen.
  useEffect(() => {
    if (!selectedId) return;
    const index = categories.findIndex((c) => c.id === selectedId);
    if (index === -1 || index < scrollIndex || index >= scrollIndex + visibleCount) {
      setSelectedId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollIndex]);

  function toggleSelect(id: string) {
    setSelectedId((prev) => (prev === id ? null : id));
  }

  // Nothing to show until the shopper picks a category, a brand, or both.
  const hasActiveFilter = selectedId !== null || brand !== null;

  const selectedProducts = useMemo(() => {
    if (!hasActiveFilter) return [];
    const q = search.trim().toLowerCase();
    const filtered = products.filter((p) => {
      if (selectedId && p.categoryId !== selectedId) return false;
      if (brand && p.brand !== brand) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.brand ?? "").toLowerCase().includes(q)
      );
    });

    const sorted =
      sortOption === "default" ? filtered : [...filtered].sort(SORT_COMPARATORS[sortOption]);

    // In-stock items always lead the list, out-of-order status aside; the
    // chosen sort still governs the order within each of the two groups.
    return [...sorted.filter((p) => p.stock > 0), ...sorted.filter((p) => p.stock <= 0)];
  }, [hasActiveFilter, selectedId, brand, products, search, sortOption]);

  return (
    <div>
      <div className="mb-2 flex flex-col gap-6 sm:flex-row">
        <div className="flex items-center justify-between gap-3 sm:w-1/3">
          <h2 className="text-xl font-semibold">Каталог товаров</h2>

          <div ref={brandMenuRef} className="relative">
            <input
              type="text"
              value={brandQuery}
              onChange={(e) => {
                const value = e.target.value;
                setBrandQuery(value);
                setBrandMenuOpen(true);
                // Editing away from the selected brand (including clearing
                // the field) drops the active filter right away, instead of
                // waiting for a new option to be picked.
                if (value !== brand) setBrand(null);
              }}
              onFocus={() => setBrandMenuOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && brandOptions.length > 0) {
                  selectBrand(brandOptions[0]);
                } else if (e.key === "Escape") {
                  setBrandMenuOpen(false);
                }
              }}
              placeholder="Выбор бренда"
              aria-haspopup="listbox"
              aria-expanded={brandMenuOpen}
              className="w-36 rounded-md border border-foreground/20 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-foreground/50 sm:w-40"
            />

            <div
              role="listbox"
              className={`scroll-transparent absolute right-0 top-full z-20 mt-1 max-h-64 w-56 overflow-y-auto rounded-md border border-foreground/10 bg-transparent shadow-lg backdrop-blur-sm transition-all duration-150 ${
                brandMenuOpen
                  ? "translate-y-0 opacity-100"
                  : "pointer-events-none -translate-y-1 opacity-0"
              }`}
            >
              <button
                type="button"
                role="option"
                aria-selected={brand === null}
                onClick={() => selectBrand(null)}
                className={`block w-full px-3 py-2 text-left text-sm hover:bg-foreground/10 ${
                  brand === null ? "font-semibold" : ""
                }`}
              >
                Выбор бренда
              </button>
              {brandOptions.map((b) => (
                <button
                  key={b}
                  type="button"
                  role="option"
                  aria-selected={brand === b}
                  onClick={() => selectBrand(b)}
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-foreground/10 ${
                    brand === b ? "font-semibold" : ""
                  }`}
                >
                  {b}
                </button>
              ))}
              {brandOptions.length === 0 && (
                <p className="px-3 py-2 text-sm text-foreground/40">Бренд не найден</p>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 sm:w-2/3">
          <div ref={sortMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setSortMenuOpen((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={sortMenuOpen}
              className="flex items-center gap-1.5 rounded-md border border-foreground/20 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-foreground/50"
            >
              {SORT_LABELS[sortOption]}
              <span className="text-foreground/40">▾</span>
            </button>

            <div
              role="listbox"
              className={`absolute left-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-md border border-foreground/10 bg-transparent shadow-lg backdrop-blur-sm transition-all duration-150 ${
                sortMenuOpen
                  ? "translate-y-0 opacity-100"
                  : "pointer-events-none -translate-y-1 opacity-0"
              }`}
            >
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  role="option"
                  aria-selected={opt === sortOption}
                  onClick={() => {
                    setSortOption(opt);
                    setSortMenuOpen(false);
                  }}
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-foreground/10 ${
                    opt === sortOption ? "font-semibold" : ""
                  }`}
                >
                  {SORT_LABELS[opt]}
                </button>
              ))}
            </div>
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по списку"
            className="w-56 rounded-md border border-foreground/20 bg-transparent px-3 py-1.5 text-right text-sm outline-none focus:border-foreground/50"
          />
        </div>
      </div>

      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="sm:w-1/3">
          <div
            onWheel={handleWheel}
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedId(null);
            }}
            className="relative overflow-hidden rounded-lg border border-foreground/10 bg-transparent"
            style={{ height: PRODUCT_AREA_HEIGHT }}
          >
            <div
              className="transition-transform duration-300 ease-out"
              style={{ transform: `translateY(-${scrollIndex * cardHeight}px)` }}
            >
              {categories.map((category) => {
                const isSelected = selectedId === category.id;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => toggleSelect(category.id)}
                    style={{ height: cardHeight }}
                    className={`flex w-full flex-col items-start justify-center border-2 px-4 text-left transition-colors ${
                      isSelected
                        ? "border-green-400 bg-green-400/5"
                        : "border-transparent hover:bg-foreground/5"
                    }`}
                  >
                    <span className="font-medium">{category.name}</span>
                    <span className="text-xs text-foreground/50">
                      {category.count} товаров
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {categories.length > visibleCount && (
            <div className="mt-2 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => scrollBy(-1)}
                disabled={scrollIndex === 0}
                aria-label="Прокрутить категории вверх"
                className="rounded-full border border-foreground/10 px-3 py-1 text-foreground/30 transition-colors hover:text-foreground disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => scrollBy(1)}
                disabled={scrollIndex === maxScrollIndex}
                aria-label="Прокрутить категории вниз"
                className="rounded-full border border-foreground/10 px-3 py-1 text-foreground/30 transition-colors hover:text-foreground disabled:opacity-30"
              >
                ↓
              </button>
            </div>
          )}
        </div>

        <div className="sm:w-2/3">
          <div
            className="scroll-transparent overflow-y-auto rounded-lg border border-foreground/10 bg-transparent"
            style={{
              height: PRODUCT_AREA_HEIGHT,
              overscrollBehavior: "contain",
            }}
          >
          {!hasActiveFilter ? (
            <div className="flex h-full items-center justify-center">
              <span className="animate-pulse text-foreground/40">
                Выберите категорию
              </span>
            </div>
          ) : selectedProducts.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <span className="text-foreground/40">Товар отсутствует</span>
            </div>
          ) : (
            selectedProducts.map((product) => (
              <div
                key={product.id}
                style={{ height: ROW_HEIGHT }}
                className="flex w-full items-center gap-3 border-b border-foreground/10 px-3 text-sm last:border-b-0 hover:bg-foreground/5"
              >
                <button
                  type="button"
                  onClick={() => setQuickViewProduct(product)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{product.name}</span>
                    <span className="block truncate text-xs text-foreground/40">
                      {product.sku}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-xs ${
                      product.stock > 0
                        ? "text-green-700 dark:text-green-500"
                        : "text-foreground/40"
                    }`}
                  >
                    {product.stock > 0 ? "В наличии" : "Под заказ"}
                  </span>
                  <span className="w-24 shrink-0 text-right font-medium">
                    {formatRub(product.price)}
                  </span>
                </button>
                <RowOrderButton product={product} />
              </div>
            ))
            )}
          </div>
        </div>
      </div>

      {quickViewProduct && (
        <ProductQuickViewModal
          product={quickViewProduct}
          onRequestClose={() => setQuickViewProduct(null)}
        />
      )}
    </div>
  );
}
