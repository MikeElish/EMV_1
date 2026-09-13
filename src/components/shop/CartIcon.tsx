"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useCart } from "@/components/shop/CartProvider";
import { formatRub } from "@/lib/money";

const ROW_HEIGHT = 44; // px
const VISIBLE_ROWS = 5;
const CLOSE_DELAY_MS = 1000;

export function CartIcon({ light = false }: { light?: boolean }) {
  const { items, totalQuantity, totalAmount } = useCart();
  const [hovered, setHovered] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearCloseTimer() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function scheduleClose() {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => setHovered(false), CLOSE_DELAY_MS);
  }

  useEffect(() => clearCloseTimer, []);

  return (
    <div
      className="relative"
      onMouseEnter={() => {
        clearCloseTimer();
        setHovered(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <Link
        href="/shop/cart"
        className={`relative flex items-center gap-1 text-sm transition-colors ${
          light
            ? "text-white/80 hover:text-white"
            : "text-foreground/70 hover:text-foreground"
        }`}
      >
        Корзина
        {totalQuantity > 0 && (
          <span
            className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-medium ${
              light ? "bg-white text-black" : "bg-foreground text-background"
            }`}
          >
            {totalQuantity}
          </span>
        )}
      </Link>

      {items.length > 0 && (
        <div
          className={`absolute right-0 top-full z-20 mt-2 w-72 overflow-hidden rounded-lg border border-white/10 bg-neutral-700/85 text-white shadow-lg backdrop-blur transition-all duration-200 ${
            hovered
              ? "translate-y-0 opacity-100"
              : "pointer-events-none -translate-y-1 opacity-0"
          }`}
        >
          <div
            className="scroll-transparent overflow-y-auto"
            onWheel={clearCloseTimer}
            style={{
              maxHeight: ROW_HEIGHT * VISIBLE_ROWS,
              overscrollBehavior: "contain",
            }}
          >
            {items.map((item) => (
              <div
                key={item.productId}
                style={{ minHeight: ROW_HEIGHT }}
                className="flex items-center gap-2 border-b border-white/10 px-3 py-2 text-sm last:border-b-0"
              >
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                <span className="shrink-0 text-white/60">× {item.quantity}</span>
                <span className="w-20 shrink-0 text-right font-medium">
                  {formatRub(item.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-white/10 bg-black/20 px-3 py-2 text-sm font-semibold">
            <span>Итого:</span>
            <span>{formatRub(totalAmount)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
