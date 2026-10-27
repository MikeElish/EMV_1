"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatShopPrice } from "@/lib/money";
import type { SearchSuggestion } from "@/app/shop/suggest/route";

const DEBOUNCE_MS = 120;

/** Matches for what is typed so far; refreshed with every new character. */
export function useSearchSuggestions(query: string) {
  const q = query.trim();
  const [result, setResult] = useState<{ q: string; items: SearchSuggestion[]; total: number } | null>(null);

  useEffect(() => {
    if (!q) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/shop/suggest?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => data && setResult({ q, items: data.items, total: data.total }))
        .catch(() => {});
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  if (!q) return null;
  // While the newest answer is on its way, the previous one stays on screen.
  return result ? { ...result, loading: result.q !== q } : { q, items: [], total: 0, loading: true };
}

/** The typed words in bold inside the product name. */
function Highlighted({ text, query }: { text: string; query: string }) {
  const words = query.split(/\s+/).filter(Boolean).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (words.length === 0) return <>{text}</>;
  const parts = text.split(new RegExp(`(${words.join("|")})`, "gi"));
  return (
    <>
      {parts.map((part, i) => (i % 2 === 1 ? <mark key={i} className="bg-transparent font-semibold text-inherit">{part}</mark> : part))}
    </>
  );
}

export const suggestionOptionId = (i: number) => `search-suggestion-${i}`;

export function SearchSuggestionsList({
  query,
  items,
  total,
  loading,
  active,
  onHover,
  onPick,
}: {
  query: string;
  items: SearchSuggestion[];
  total: number;
  loading: boolean;
  active: number;
  onHover: (i: number) => void;
  onPick: () => void;
}) {
  // Thumbnails only once some of the matches have photos.
  const withPhotos = items.some((item) => item.image);
  return (
    <div
      // keep the focus in the field while clicking a match
      onMouseDown={(e) => e.preventDefault()}
      className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-foreground/15 bg-background text-foreground shadow-xl"
    >
      {items.length === 0 ? (
        <p className="px-3 py-3 text-sm text-foreground/50">{loading ? "Ищем…" : "Ничего не найдено"}</p>
      ) : (
        <ul id="search-suggestions" role="listbox" aria-label="Совпадения" className={loading ? "opacity-70" : ""}>
          {items.map((item, i) => (
            <li key={item.slug} id={suggestionOptionId(i)} role="option" aria-selected={i === active}>
              <Link
                href={`/shop/product/${item.slug}`}
                onClick={onPick}
                onMouseEnter={() => onHover(i)}
                className={`flex items-center gap-3 px-3 py-2 text-sm ${i === active ? "bg-foreground/[0.07]" : ""}`}
              >
                {withPhotos && (
                  <span className="h-9 w-9 shrink-0 overflow-hidden rounded bg-foreground/[0.05]">
                    {item.image && (
                      // eslint-disable-next-line @next/next/no-img-element -- small thumbnail from /uploads
                      <img src={item.image} alt="" className="h-full w-full object-cover" draggable={false} />
                    )}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">
                    <Highlighted text={item.name} query={query} />
                  </span>
                  <span className="block truncate text-xs text-foreground/50">
                    {[item.brand, item.sku].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-medium">{formatShopPrice(item.price)}</span>
                  <span className={`block text-xs ${item.inStock ? "text-green-700 dark:text-green-500" : "text-foreground/40"}`}>
                    {item.inStock ? "В наличии" : "Под заказ"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {total > items.length && (
        <Link
          href={`/shop/search?q=${encodeURIComponent(query)}`}
          onClick={onPick}
          className="block border-t border-foreground/10 px-3 py-2 text-sm text-foreground/70 hover:bg-foreground/[0.05] hover:text-foreground"
        >
          Все результаты ({total}) →
        </Link>
      )}
    </div>
  );
}
