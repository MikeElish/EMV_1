"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackPageView } from "@/lib/metrika";

/**
 * Pages change without a reload, so Metrika would count one page per visit.
 * Each client-side navigation is reported as a page view; the first load is
 * already counted by the counter itself.
 */
export function MetrikaPageViews() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const previous = useRef<string | null>(null);

  useEffect(() => {
    const url = location.origin + pathname + (search ? `?${search}` : "");
    if (previous.current !== null && previous.current !== url && !pathname.startsWith("/admin")) {
      trackPageView(url, previous.current);
    }
    previous.current = url;
  }, [pathname, search]);

  return null;
}
