"use client";

import { useRef, useState } from "react";
import { AnchoredDropdown } from "@/components/AnchoredDropdown";

export function ActionMenu({ items }: { items: { label: string; onClick: () => void; disabled?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border border-foreground/20 px-2 py-1 text-xs hover:bg-foreground/5"
      >
        Действие ▾
      </button>
      <AnchoredDropdown
        anchorRef={ref}
        open={open}
        className="rounded-md border border-foreground/10 bg-background text-sm shadow-lg"
      >
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            disabled={item.disabled}
            onClick={() => {
              setOpen(false);
              item.onClick();
            }}
            className="block w-full px-3 py-1.5 text-left hover:bg-foreground/5 disabled:opacity-40"
          >
            {item.label}
          </button>
        ))}
      </AnchoredDropdown>
    </>
  );
}
