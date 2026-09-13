"use client";

import { useEffect, useRef, useState } from "react";
import type { Product } from "@prisma/client";
import { formatRub } from "@/lib/money";
import { ProductQuickViewModal } from "@/components/shop/ProductQuickViewModal";
import { RowOrderButton } from "@/components/shop/RowOrderButton";

export type RotatorDirection = {
  key: string;
  label: string;
  items: Product[];
};

const ROWS = 5;
const ROW_HEIGHT = 52; // px
const STAGGER_MS = 500;
const TRANSITION_MS = 500;
const CYCLE_MS = 5000;

type RowState = {
  current: Product;
  next: Product;
  original: Product;
  showingNew: boolean;
  instant: boolean;
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sampleN(pool: Product[], n: number, shuffled: boolean): Product[] {
  if (pool.length === 0) return [];
  const base = shuffled ? shuffle(pool) : pool;
  if (base.length >= n) return base.slice(0, n);
  const result: Product[] = [];
  while (result.length < n) result.push(...(shuffled ? shuffle(pool) : pool));
  return result.slice(0, n);
}

export function NewArrivalsRotator({ directions }: { directions: RotatorDirection[] }) {
  const available = directions.filter((d) => d.items.length > 0);

  const [label, setLabel] = useState(available[0]?.label ?? "");
  const [rowState, setRowState] = useState<RowState[]>(() => {
    const initial = sampleN(available[0]?.items ?? [], ROWS, false);
    return initial.map((item) => ({
      current: item,
      next: item,
      original: item,
      showingNew: false,
      instant: false,
    }));
  });
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  const dirIndexRef = useRef(0);
  const cycleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const activeForwardRef = useRef<boolean[]>(new Array(ROWS).fill(false));
  const settledRef = useRef<boolean[]>(new Array(ROWS).fill(false));
  const settledCountRef = useRef(0);
  const cascadeInProgressRef = useRef(false);
  const previousLabelRef = useRef(label);

  function clearRowTimers() {
    rowTimersRef.current.forEach(clearTimeout);
    rowTimersRef.current = [];
  }

  function scheduleCycle() {
    if (cycleTimerRef.current) clearTimeout(cycleTimerRef.current);
    if (available.length === 0) return;
    cycleTimerRef.current = setTimeout(beginForwardCascade, CYCLE_MS);
  }

  function beginForwardCascade() {
    if (available.length === 0) return;
    dirIndexRef.current = (dirIndexRef.current + 1) % available.length;
    const dir = available[dirIndexRef.current];
    const sample = sampleN(dir.items, ROWS, true);

    previousLabelRef.current = label;
    setLabel(dir.label);

    activeForwardRef.current = new Array(ROWS).fill(false);
    settledRef.current = new Array(ROWS).fill(false);
    settledCountRef.current = 0;
    cascadeInProgressRef.current = true;

    clearRowTimers();
    setRowState((prev) => prev.map((r) => ({ ...r, original: r.current })));

    for (let i = 0; i < ROWS; i++) {
      const t = setTimeout(() => {
        activeForwardRef.current[i] = true;
        setRowState((prev) =>
          prev.map((r, idx) => (idx === i ? { ...r, next: sample[i] ?? r.current, showingNew: true } : r))
        );
      }, i * STAGGER_MS);
      rowTimersRef.current.push(t);
    }

    // Next cycle starts a fixed 5s after this one began, regardless of how
    // long the cascade animation itself takes to finish.
    scheduleCycle();
  }

  function cancelAndRevert() {
    clearRowTimers();
    if (cycleTimerRef.current) clearTimeout(cycleTimerRef.current);

    const activeIndices: number[] = [];
    for (let i = 0; i < ROWS; i++) if (activeForwardRef.current[i]) activeIndices.push(i);
    activeIndices.reverse();

    activeIndices.forEach((rowIndex, order) => {
      const t = setTimeout(() => {
        setRowState((prev) =>
          prev.map((r, idx) => {
            if (idx !== rowIndex) return r;
            if (settledRef.current[rowIndex]) {
              // Already settled on the new item -- flip again, back to the original.
              return { ...r, next: r.original, showingNew: true };
            }
            // Still mid-flight (or just triggered) -- reverse straight back.
            return { ...r, showingNew: false };
          })
        );
      }, order * STAGGER_MS);
      rowTimersRef.current.push(t);
    });

    setLabel(previousLabelRef.current);
    activeForwardRef.current = new Array(ROWS).fill(false);
    settledRef.current = new Array(ROWS).fill(false);
    cascadeInProgressRef.current = false;
  }

  function handleRowTransitionEnd(i: number) {
    setRowState((prev) => {
      const r = prev[i];
      if (!r.showingNew) return prev; // reversed mid-flight -- nothing to settle

      settledRef.current[i] = true;
      settledCountRef.current += 1;
      if (settledCountRef.current === ROWS) cascadeInProgressRef.current = false;

      const settled: RowState = { ...r, current: r.next, showingNew: false, instant: true };
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setRowState((p2) => p2.map((rr, idx) => (idx === i ? { ...rr, instant: false } : rr)));
        });
      });
      return prev.map((rr, idx) => (idx === i ? settled : rr));
    });
  }

  useEffect(() => {
    scheduleCycle();
    return () => {
      if (cycleTimerRef.current) clearTimeout(cycleTimerRef.current);
      clearRowTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleMouseEnter() {
    if (cycleTimerRef.current) clearTimeout(cycleTimerRef.current);
    if (cascadeInProgressRef.current) cancelAndRevert();
  }

  function handleMouseLeave() {
    scheduleCycle();
  }

  if (available.length === 0) return null;

  function renderSlot(product: Product) {
    return (
      <div
        style={{ height: ROW_HEIGHT }}
        className="flex w-full shrink-0 items-center gap-3 px-3 text-sm hover:bg-foreground/5"
      >
        <button
          type="button"
          onClick={() => setQuickViewProduct(product)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate">{product.name}</span>
            <span className="block truncate text-xs text-foreground/40">{product.sku}</span>
          </span>
          <span
            className={`shrink-0 text-xs ${
              product.stock > 0 ? "text-green-700 dark:text-green-500" : "text-foreground/40"
            }`}
          >
            {product.stock > 0 ? "В наличии" : "Под заказ"}
          </span>
          <span className="w-24 shrink-0 text-right font-medium">{formatRub(product.price)}</span>
        </button>
        <RowOrderButton product={product} />
      </div>
    );
  }

  return (
    <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <h2 className="text-xl font-semibold">{label}</h2>

      <div className="mt-4 overflow-hidden rounded-lg border border-foreground/10">
        {rowState.map((r, i) => (
          <div
            key={i}
            style={{ height: ROW_HEIGHT }}
            className="overflow-hidden border-b border-foreground/10 last:border-b-0"
          >
            <div
              onTransitionEnd={() => handleRowTransitionEnd(i)}
              className="flex flex-col"
              style={{
                transform: `translateY(${r.showingNew ? -ROW_HEIGHT : 0}px)`,
                transition: r.instant ? "none" : `transform ${TRANSITION_MS}ms ease`,
              }}
            >
              {renderSlot(r.current)}
              {renderSlot(r.next)}
            </div>
          </div>
        ))}
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
