"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

export type NavTab = { href: string; label: string };

// Lives inside the <Link> so useLinkStatus can report the click immediately,
// before the destination's data has arrived.
function TabIndicator({ active }: { active: boolean }) {
  const { pending } = useLinkStatus();
  if (!active && !pending) return null;
  return (
    <span
      aria-hidden
      className={`absolute inset-x-0 -bottom-px h-0.5 ${pending ? "animate-pulse bg-foreground/40" : "bg-foreground"}`}
    />
  );
}

export function NavTabs({ tabs, children }: { tabs: NavTab[]; children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div>
      <div className="flex gap-6 border-b border-foreground/10">
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              prefetch
              className={`relative px-1 pb-3 text-sm font-medium transition-colors ${
                active ? "text-foreground" : "text-foreground/50 hover:text-foreground"
              }`}
            >
              {tab.label}
              <TabIndicator active={active} />
            </Link>
          );
        })}
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
