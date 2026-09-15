"use client";

import { useEffect, useRef, useState } from "react";

// Positions the panel with `position: fixed`, computed from the trigger's
// bounding rect on open, rather than `absolute` inside whatever ancestor
// happens to render it -- a plain `absolute` panel gets silently clipped
// when a parent (e.g. a table's `overflow-x-auto` wrapper) doesn't allow
// overflow, which `fixed` positioning escapes regardless of ancestors.
export function DropdownMenu({
  label,
  buttonClassName,
  children,
}: {
  label: string;
  buttonClassName?: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function toggle() {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpen((v) => !v);
  }

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <>
      <button ref={buttonRef} type="button" onClick={toggle} className={buttonClassName}>
        {label}
      </button>
      {open && pos && (
        <div
          ref={panelRef}
          style={{ position: "fixed", top: pos.top, right: pos.right }}
          className="z-20 w-56 rounded-md border border-foreground/10 bg-background py-1 text-sm shadow-lg"
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </>
  );
}
