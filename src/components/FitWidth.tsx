"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * Scales its content down (CSS zoom -- fonts, paddings, inputs, everything)
 * when it is wider than the space available, so a wide table fits the
 * screen without horizontal scrolling. Never scales up; below `minZoom` the
 * frame scrolls instead. When the content fits, nothing is touched.
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
    let frame = 0;

    // Applied straight to the DOM (no React re-render on every resize), all
    // within one task, so the measuring layout is never painted.
    const fit = () => {
      const available = outer.clientWidth;
      if (!available) return;
      // The narrowest the content can get by wrapping its text -- what the
      // browser would squeeze a table to anyway before it overflows.
      inner.style.zoom = "";
      inner.style.width = "min-content";
      const needed = inner.getBoundingClientRect().width;
      const zoom = needed ? Math.max(minZoom, Math.min(1, available / needed)) : 1;
      if (zoom > 0.999) {
        inner.style.width = "";
        return;
      }
      // Laid out as wide as the scaled-down box needs, then shrunk to fit.
      // Small text is relatively wider than full-size text, so squeeze a
      // little more while something still sticks out.
      let current = zoom;
      for (let i = 0; i < 4; i++) {
        inner.style.width = `${available / current}px`;
        inner.style.zoom = String(current);
        const overflow = inner.scrollWidth / inner.clientWidth;
        if (overflow <= 1.001 || current <= minZoom) break;
        current = Math.max(minZoom, current / overflow);
      }
    };

    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    });
    observer.observe(outer);
    observer.observe(inner);
    fit();
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
