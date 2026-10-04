import { FitWidth } from "@/components/FitWidth";
import { forwardRef } from "react";

// CRM tables fill the window under the tabs: the toolbar above stays put,
// only the table body scrolls, and its header row sticks to the top. A table
// wider than the window is scaled down to fit it (FitWidth).

/** Root of a CRM table page: takes the rest of the window. */
export function CrmPage({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-0 flex-1 flex-col">{children}</div>;
}

/** The scrolling frame around a table (both directions). */
export const CrmTableScroll = forwardRef<HTMLDivElement, { children: React.ReactNode; className?: string }>(
  function CrmTableScroll({ children, className = "mt-4" }, ref) {
    return (
      <div ref={ref} data-crm-scroll="" className={`min-h-0 flex-1 overflow-auto [scrollbar-gutter:stable] ${className}`}>
        <FitWidth>{children}</FitWidth>
      </div>
    );
  }
);

/** For <thead>: sticks to the top of CrmTableScroll, with a hairline under it. */
export const STICKY_THEAD =
  "sticky top-0 z-10 bg-background shadow-[0_1px_0_0_rgb(128_128_128/0.25)]";
