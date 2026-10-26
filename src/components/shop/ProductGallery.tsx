"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ProtectedImage } from "@/components/shop/ProtectedImage";

const SWIPE_PX = 40;

/**
 * Product photos: one at a time in a square frame; a tap on the photo or the
 * arrows go to the next one, a swipe on phones, ← / → keys; thumbnails below.
 */
export function ProductGallery({ images, alt }: { images: string[]; alt: string }) {
  const [index, setIndex] = useState(0);
  const swipeStart = useRef<number | null>(null);
  const swiped = useRef(false);
  const many = images.length > 1;

  const go = (step: number) => setIndex((i) => (i + step + images.length) % images.length);

  function onPointerDown(e: PointerEvent) {
    swipeStart.current = e.clientX;
    swiped.current = false;
  }
  function onPointerUp(e: PointerEvent) {
    if (swipeStart.current === null) return;
    const dx = e.clientX - swipeStart.current;
    swipeStart.current = null;
    if (many && Math.abs(dx) > SWIPE_PX) {
      swiped.current = true;
      go(dx < 0 ? 1 : -1);
    }
  }
  function onKeyDown(e: KeyboardEvent) {
    if (!many) return;
    if (e.key === "ArrowRight") go(1);
    else if (e.key === "ArrowLeft") go(-1);
    else return;
    e.preventDefault();
  }

  if (images.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-foreground/[0.03] text-sm text-foreground/30">
        Фото скоро
      </div>
    );
  }

  const arrow = "absolute top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-lg text-white transition-colors hover:bg-black/70";

  return (
    <div>
      <div
        role="group"
        aria-roledescription="галерея"
        aria-label={many ? `Фото ${index + 1} из ${images.length}` : undefined}
        tabIndex={many ? 0 : undefined}
        onKeyDown={onKeyDown}
        className="relative aspect-square touch-pan-y select-none overflow-hidden rounded-lg bg-foreground/[0.03] outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (swipeStart.current = null)}
      >
        <button
          type="button"
          onClick={() => {
            // a swipe already turned the page
            if (swiped.current) return void (swiped.current = false);
            if (many) go(1);
          }}
          aria-label={many ? "Следующее фото" : undefined}
          tabIndex={-1}
          className={`block h-full w-full ${many ? "cursor-pointer" : "cursor-default"}`}
        >
          <ProtectedImage src={images[index]} alt={alt} className="h-full w-full object-cover" />
        </button>
        {many && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Предыдущее фото" className={`${arrow} left-2`}>
              ‹
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Следующее фото" className={`${arrow} right-2`}>
              ›
            </button>
            <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/45 px-2 py-0.5 text-xs text-white">
              {index + 1} / {images.length}
            </span>
          </>
        )}
      </div>

      {many && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Фото ${i + 1}`}
              aria-current={i === index ? "true" : undefined}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 transition-opacity ${
                i === index ? "border-foreground/70" : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              <ProtectedImage src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
