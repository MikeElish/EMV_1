"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { FitWidth } from "@/components/FitWidth";

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

/**
 * `fill`: the section takes the rest of the window and the tabs stay put --
 * a page can then keep its toolbar fixed and scroll only its table
 * (see CrmTableFrame).
 */
export function NavTabs({
  tabs,
  children,
  fill = false,
}: {
  tabs: NavTab[];
  children: React.ReactNode;
  fill?: boolean;
}) {
  const pathname = usePathname();

  return (
    <div className={fill ? "flex min-h-0 flex-1 flex-col" : undefined}>
      {/* A row of tabs wider than the window is scaled down like the tables. */}
      <FitWidth className="shrink-0">
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
      </FitWidth>
      <div className={fill ? "mt-6 flex min-h-0 flex-1 flex-col overflow-auto [scrollbar-gutter:stable]" : "mt-6"}>
        {children}
      </div>
    </div>
  );
}
