"use client";

import { useState } from "react";
import { useOutsideClose } from "@/lib/use-outside-close";

export type DeliveryMethod = "address" | "terminal" | "pickup";

export const DELIVERY_LABELS: Record<DeliveryMethod, string> = {
  address: "До адреса",
  terminal: "До терминала",
  pickup: "Самовывоз",
};
export const DELIVERY_OPTIONS = Object.keys(DELIVERY_LABELS) as DeliveryMethod[];

export function DeliveryMethodSelect({
  value,
  onChange,
}: {
  value: DeliveryMethod | null;
  onChange: (v: DeliveryMethod) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-48 items-center justify-between gap-1.5 rounded-md border border-foreground/20 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-foreground/50"
      >
        <span className={value ? "" : "text-foreground/40"}>
          {value ? DELIVERY_LABELS[value] : "Выберите способ"}
        </span>
        <span className="text-foreground/40">▾</span>
      </button>

      <div
        role="listbox"
        className={`scroll-transparent absolute right-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-md border border-foreground/10 bg-transparent shadow-lg backdrop-blur-sm transition-all duration-150 ${
          open ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-1 opacity-0"
        }`}
      >
        {DELIVERY_OPTIONS.map((opt) => (
          <button
            key={opt}
            type="button"
            role="option"
            aria-selected={value === opt}
            onClick={() => {
              onChange(opt);
              setOpen(false);
            }}
            className={`block w-full px-3 py-2 text-left text-sm hover:bg-foreground/10 ${
              value === opt ? "font-semibold" : ""
            }`}
          >
            {DELIVERY_LABELS[opt]}
          </button>
        ))}
      </div>
    </div>
  );
}
