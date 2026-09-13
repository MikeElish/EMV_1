"use client";

import { useEffect, useState } from "react";
import { taxiContent } from "@/content/taxi";

const TRANSITION_MS = 200;

type Tariff = {
  className: string;
  color: string;
  description: string;
  longDescription: string;
  priceFrom: string;
};

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path
        d={direction === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TariffsCarousel({ tariffs }: { tariffs: Tariff[] }) {
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState<Tariff | null>(null);
  const [visible, setVisible] = useState(false);

  function go(delta: number) {
    setIndex((i) => (i + delta + tariffs.length) % tariffs.length);
  }

  function open(tariff: Tariff) {
    setExpanded(tariff);
  }

  useEffect(() => {
    if (!expanded) return;
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, [expanded]);

  function close() {
    setVisible(false);
    setTimeout(() => setExpanded(null), TRANSITION_MS);
  }

  useEffect(() => {
    if (!expanded) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  return (
    <div className="relative mx-auto mt-8 max-w-sm">
      <div className="overflow-hidden rounded-xl">
        <div
          className="flex transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {tariffs.map((tariff) => (
            <div key={tariff.className} className="w-full shrink-0 px-1">
              <button
                type="button"
                onClick={() => open(tariff)}
                className={`tariff-text--${tariff.color} relative isolate flex w-full flex-col items-start overflow-hidden rounded-xl p-6 text-left shadow-md transition-transform duration-200 hover:scale-[1.02]`}
              >
                <span
                  className={`tariff-card-fill tariff-card-fill--${tariff.color}`}
                  aria-hidden="true"
                />
                <span className="relative text-lg font-semibold">
                  {tariff.className}
                </span>
                <span className="relative mt-2 text-sm opacity-80">
                  {tariff.description}
                </span>
                <span className="relative mt-4 font-semibold">
                  {tariff.priceFrom}
                </span>
              </button>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => go(-1)}
        aria-label="Предыдущий тариф"
        className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-transparent hover:bg-white/10"
      >
        <ChevronIcon direction="left" />
      </button>
      <button
        type="button"
        onClick={() => go(1)}
        aria-label="Следующий тариф"
        className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-transparent hover:bg-white/10"
      >
        <ChevronIcon direction="right" />
      </button>

      <div className="mt-4 flex justify-center gap-2">
        {tariffs.map((tariff, i) => (
          <button
            key={tariff.className}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Показать тариф ${tariff.className}`}
            className={`h-2 w-2 rounded-full transition-colors ${
              i === index ? "bg-foreground" : "bg-foreground/20"
            }`}
          />
        ))}
      </div>

      {expanded && (
        <div
          onClick={close}
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 transition-opacity duration-200 ${
            visible ? "opacity-100" : "opacity-0"
          }`}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`relative isolate w-full max-w-md overflow-hidden rounded-2xl p-8 shadow-2xl transition-all duration-200 ${
              visible ? "scale-100 opacity-100" : "scale-90 opacity-0"
            } tariff-text--${expanded.color}`}
          >
            <span
              className={`tariff-card-fill tariff-card-fill--${expanded.color}`}
              aria-hidden="true"
            />
            <h3 className="relative text-2xl font-bold">{expanded.className}</h3>
            <p className="relative mt-4 text-sm leading-relaxed opacity-90">
              {expanded.longDescription}
            </p>
            <p className="relative mt-6 text-2xl font-semibold">
              {expanded.priceFrom}
            </p>
            <a
              href={`tel:${taxiContent.contacts.phoneHref}`}
              className="tariff-order-btn relative mt-6 block rounded-md px-6 py-3 text-center font-medium shadow-md transition-opacity hover:opacity-90"
            >
              Заказать
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
