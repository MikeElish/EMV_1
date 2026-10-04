"use client";

import { useLayoutEffect, useRef } from "react";

// A full recalculation only when the frame width changes by more than this:
// a vertical scrollbar appearing/disappearing (≈17px on Windows) must not
// rock the scale.
const RECALC_THRESHOLD_PX = 24;

/**
 * Scales its content down (CSS zoom -- fonts, paddings, inputs, everything)
 * when it is wider than the space available, so a wide table fits the
 * screen without horizontal scrolling. Never scales up; below `minZoom` the
 * frame scrolls instead. When the content fits, nothing is touched.
 *
 * Stability matters more than the last pixel: the scale is worked out when
 * the page opens and when the window gets noticeably wider or narrower. While
 * someone works with the table (filters, status changes, refreshed rows) it
 * only ever shrinks, and only if something actually sticks out.
 */
export function FitWidth({
  children,
  className,
  minZoom = 0.45,
}: {
  children: React.ReactNode;
  className?: string;
  minZoom?: number;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    let zoom = 1;
    let fittedFor = 0; // frame width the current zoom was worked out for
    let frame = 0;

    // Straight to the DOM -- no React re-render.
    const apply = (next: number, available: number) => {
      zoom = next > 0.999 ? 1 : next;
      inner.style.width = zoom === 1 ? "" : `${available / zoom}px`;
      inner.style.zoom = zoom === 1 ? "" : String(zoom);
    };

    // Squeeze a little more while something still sticks out (small text is
    // relatively wider than full-size text).
    const squeeze = (available: number) => {
      for (let i = 0; i < 4 && zoom > minZoom; i++) {
        const overflow = inner.scrollWidth / inner.clientWidth;
        if (overflow <= 1.001) break;
        apply(Math.max(minZoom, zoom / overflow), available);
      }
    };

    // Full calculation, all in one task so the measuring layout is never
    // painted: the narrowest the content can get by wrapping its text.
    const fit = (available: number) => {
      inner.style.zoom = "";
      inner.style.width = "min-content";
      const needed = inner.getBoundingClientRect().width;
      apply(needed ? Math.max(minZoom, Math.min(1, available / needed)) : 1, available);
      squeeze(available);
      fittedFor = available;
    };

    const check = () => {
      const available = outer.clientWidth;
      if (!available) return;
      if (!fittedFor || Math.abs(available - fittedFor) > RECALC_THRESHOLD_PX) {
        fit(available);
      } else if (available < fittedFor) {
        // A bit narrower (a scrollbar appeared): keep the scale, shrink only if needed.
        apply(zoom, available);
        squeeze(available);
        fittedFor = available;
      } else {
        // Same frame, the content changed: only shrink if it no longer fits.
        squeeze(fittedFor);
      }
    };

    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(check);
    });
    observer.observe(outer);
    observer.observe(inner);
    check();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [minZoom]);

  return (
    <div ref={outerRef} className={className}>
      <div ref={innerRef} data-fit-width="">
        {children}
      </div>
    </div>
  );
}
