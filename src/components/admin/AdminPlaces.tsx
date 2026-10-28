"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// The admin opens where the employee left it. Every page visited is kept
// (in this browser) under each of its section paths -- /admin/crm,
// /admin/crm/orders, ... -- so the sidebar, the tabs and ☰ lead back to the
// last page of a block or a tab with its address (filters, page number). The
// tables' search text and scroll position are kept for the page too (for
// this browser tab). Почта keeps its own place (LastMailPlace).

const PLACES_KEY = "emv-admin-places";
const listeners = new Set<() => void>();

function readPlaces(): string {
  try {
    return localStorage.getItem(PLACES_KEY) ?? "{}";
  } catch {
    return "{}";
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === PLACES_KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function savePlace(url: string) {
  const path = url.split("?")[0];
  if (path.startsWith("/admin/mail")) return;
  const parts = path.split("/").filter(Boolean);
  if (parts.length < 2) return;
  let places: Record<string, string>;
  try {
    places = JSON.parse(readPlaces());
  } catch {
    places = {};
  }
  // /admin/crm/orders/x → kept for /admin/crm, /admin/crm/orders, /admin/crm/orders/x.
  for (let i = 2; i <= parts.length; i++) places["/" + parts.slice(0, i).join("/")] = url;
  try {
    localStorage.setItem(PLACES_KEY, JSON.stringify(places));
  } catch {
    return;
  }
  for (const l of listeners) l();
}

/** `place(href)`: the last page visited under `href`, else `href` itself. Before hydration -- `href`. */
export function useAdminPlaces(): (href: string) => string {
  const raw = useSyncExternalStore(subscribe, readPlaces, () => "{}");
  return useMemo(() => {
    let places: Record<string, string> = {};
    try {
      places = JSON.parse(raw);
    } catch {
      // ignore
    }
    return (href: string) => {
      const saved = places[href];
      return saved && (saved === href || saved.startsWith(href + "/") || saved.startsWith(href + "?")) ? saved : href;
    };
  }, [raw]);
}

const scrollKey = (url: string, i: number) => `emv-admin-scroll:${url}:${i}`;

/** The scrolling parts of a page: <main> and the CRM table frames. */
function scrollers(): HTMLElement[] {
  return [document.getElementById("admin-main"), ...document.querySelectorAll<HTMLElement>("[data-crm-scroll]")].filter(
    (el): el is HTMLElement => !!el
  );
}

/** In the admin layout: keeps the current place and the page's scroll position. */
export function RememberAdminPlace() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const url = search ? `${pathname}?${search}` : pathname;

  useEffect(() => {
    savePlace(url);
  }, [url]);

  useEffect(() => {
    // Back on a page: its scroll as it was (again a moment later, when a
    // restored search has filtered the table).
    const restore = () =>
      scrollers().forEach((el, i) => {
        try {
          const saved = sessionStorage.getItem(scrollKey(url, i));
          if (saved) {
            const [top, left] = saved.split(",").map(Number);
            el.scrollTo(left || 0, top || 0);
          }
        } catch {
          // storage unavailable
        }
      });
    const frame = requestAnimationFrame(restore);
    const later = setTimeout(restore, 250);

    let pending = false;
    const onScroll = (e: Event) => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        const list = scrollers();
        const i = list.indexOf(e.target as HTMLElement);
        if (i < 0) return;
        try {
          sessionStorage.setItem(scrollKey(url, i), `${list[i].scrollTop},${list[i].scrollLeft}`);
        } catch {
          // storage unavailable
        }
      });
    };
    document.addEventListener("scroll", onScroll, true);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(later);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, [url]);

  return null;
}

/**
 * useState for a table's search (or filters) that the page keeps: back on
 * the page, it is as it was. Kept for this browser tab. `restore: false` --
 * the page was opened for something given (an order number in the link):
 * that wins over what was kept.
 */
export function useRememberedState<T>(
  name: string,
  initial: T,
  { restore = true }: { restore?: boolean } = {}
): [T, (next: T | ((prev: T) => T)) => void] {
  const pathname = usePathname();
  const key = `emv-admin-state:${pathname}:${name}`;
  const [value, setValue] = useState(initial);
  useEffect(() => {
    if (!restore) return;
    try {
      const saved = sessionStorage.getItem(key);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only memory, read after hydration
      if (saved !== null) setValue(JSON.parse(saved) as T);
    } catch {
      // storage unavailable
    }
    // Only when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const v = typeof next === "function" ? (next as (prev: T) => T)(prev) : next;
        try {
          sessionStorage.setItem(key, JSON.stringify(v));
        } catch {
          // storage unavailable
        }
        return v;
      });
    },
    [key]
  );
  return [value, set];
}
