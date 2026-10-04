"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Renders overlays (modals, dropdown panels) at the root of the section --
 * #admin-root / #shop-root, so they keep that section's theme -- instead of
 * where they are declared. Inside a FitWidth-scaled table they would
 * otherwise shrink with it and land in the wrong place.
 */
export function ThemedPortal({ children }: { children: React.ReactNode }) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [target, setTarget] = useState<Element | null>(null);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const themed = "[data-admin-theme], [data-shop-theme]";
    // Declared outside a section (site-wide dialogs in the root layout):
    // take the section of the page that is open.
    setTarget(anchor?.closest(themed) ?? document.querySelector(themed) ?? document.body);
  }, []);

  return (
    <>
      <span ref={anchorRef} hidden />
      {target && createPortal(children, target)}
    </>
  );
}
