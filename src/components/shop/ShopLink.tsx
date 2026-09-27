"use client";

import { useState } from "react";
import Link, { useLinkStatus } from "next/link";

// Shown only while a click is still waiting on the server (the route wasn't
// prefetched yet) -- a thin bar instead of the page just freezing.
function PendingBar() {
  const { pending } = useLinkStatus();
  return pending ? (
    <span aria-hidden className="fixed inset-x-0 top-0 z-[100] h-0.5 animate-pulse bg-foreground/60" />
  ) : null;
}

/**
 * Link for dynamic shop routes, which Next.js doesn't prefetch on its own.
 * `eager` prefetches the full page as soon as the link is visible -- for a
 * handful of navigation links. Otherwise it prefetches on hover/focus/touch,
 * so a grid of hundreds of product cards doesn't hit the server for every
 * card a visitor merely scrolls past.
 */
export function ShopLink({
  href,
  eager = false,
  className,
  children,
  ...rest
}: {
  href: string;
  eager?: boolean;
  className?: string;
  children: React.ReactNode;
  "aria-label"?: string;
}) {
  const [intent, setIntent] = useState(false);

  return (
    <Link
      href={href}
      prefetch={eager || intent ? true : false}
      onMouseEnter={() => setIntent(true)}
      onFocus={() => setIntent(true)}
      onTouchStart={() => setIntent(true)}
      className={className}
      {...rest}
    >
      {children}
      <PendingBar />
    </Link>
  );
}
