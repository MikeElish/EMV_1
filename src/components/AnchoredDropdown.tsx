"use client";

import { useLayoutEffect, useState, type ReactNode, type RefObject } from "react";
import { ThemedPortal } from "@/components/ThemedPortal";

const MAX_PANEL_HEIGHT = 168;
const VIEWPORT_PADDING = 8;
const DROPDOWN_LAYER = 2_147_483_000;

type Position = {
  left: number;
  width: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
};

export function AnchoredDropdown({
  anchorRef,
  open,
  className,
  children,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  className: string;
  children: ReactNode;
}) {
  const [position, setPosition] = useState<Position | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const anchor = anchorRef.current;
    if (!anchor) return;

    const updatePosition = () => {
      const rect = anchor.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom - VIEWPORT_PADDING;
      const above = rect.top - VIEWPORT_PADDING;
      const openAbove = below < MAX_PANEL_HEIGHT && above > below;
      const available = openAbove ? above : below;
      const width = Math.min(rect.width, window.innerWidth - VIEWPORT_PADDING * 2);

      setPosition({
        left: Math.max(VIEWPORT_PADDING, Math.min(rect.left, window.innerWidth - width - VIEWPORT_PADDING)),
        width,
        maxHeight: Math.max(40, Math.min(MAX_PANEL_HEIGHT, available)),
        ...(openAbove
          ? { bottom: window.innerHeight - rect.top + 4 }
          : { top: rect.bottom + 4 }),
      });
    };

    updatePosition();
    document.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    window.visualViewport?.addEventListener("scroll", updatePosition);
    window.visualViewport?.addEventListener("resize", updatePosition);
    const observer = new ResizeObserver(updatePosition);
    observer.observe(anchor);

    return () => {
      document.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
      window.visualViewport?.removeEventListener("scroll", updatePosition);
      window.visualViewport?.removeEventListener("resize", updatePosition);
      observer.disconnect();
    };
  }, [anchorRef, open]);

  if (!open) return null;

  return (
    <ThemedPortal>
      <div
        className={className}
        style={{
          position: "fixed",
          zIndex: DROPDOWN_LAYER,
          overflowY: "auto",
          ...(!position
            ? { top: 0, left: 0, width: 0, maxHeight: 0, visibility: "hidden" as const }
            : position),
        }}
      >
        {children}
      </div>
    </ThemedPortal>
  );
}
