"use client";

import { useEscape } from "@/lib/use-escape";
import { cssZoomOf } from "@/lib/css-zoom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

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
  label: React.ReactNode;
  buttonClassName?: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useEscape(() => setOpen(false), open);

  function computePos() {
    if (!buttonRef.current) return null;
    const zoom = cssZoomOf(buttonRef.current);
    const rect = buttonRef.current.getBoundingClientRect();
    return {
      top: (rect.bottom + 4) / zoom,
      right: (window.innerWidth - rect.right) / zoom,
      zoom,
      buttonTop: rect.top / zoom,
      buttonBottom: rect.bottom / zoom,
    };
  }

  function toggle() {
    if (!open) {
      setPos(computePos());
    }
    setOpen((v) => !v);
  }

  // Flip the panel above the trigger when it would overflow the viewport bottom.
  useLayoutEffect(() => {
    if (!open || !pos || !panelRef.current || !buttonRef.current) return;
    const panelHeight = panelRef.current.getBoundingClientRect().height;
    const initial = computePos();
    if (!initial) return;
    const availableBelow = window.innerHeight / initial.zoom - initial.buttonBottom - 4;
    if (panelHeight > availableBelow) {
      setPos({ top: initial.buttonTop - panelHeight / initial.zoom - 4, right: pos.right });
    }
  }, [open]);

  // Keep the panel aligned on window resize/scroll while it stays open.
  useEffect(() => {
    if (!open) return;
    function update() {
      setPos(computePos());
    }
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

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
    document.addEventListener("click", onClickOutside);
    return () => document.removeEventListener("click", onClickOutside);
  }, []);

  return (
    <>
      <button ref={buttonRef} type="button" onClick={toggle} className={buttonClassName}>
        {label}
      </button>
      {open && pos && (
        <div
          ref={panelRef}
          onClick={(e) => e.stopPropagation()}
          style={{ position: "fixed", top: pos.top, right: pos.right }}
          className="z-20 max-h-[calc(100vh-16px)] w-56 overflow-y-auto rounded-md border border-foreground/10 bg-background py-1 text-sm shadow-lg"
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </>
  );
}
