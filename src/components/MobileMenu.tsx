"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useEscape } from "@/lib/use-escape";

/**
 * ☰ on phones: a panel sliding in from the right with the section's links.
 * Closes on a link (the page changes), ✕, Esc or a tap outside. The caller
 * hides the button on wide screens (e.g. `className="sm:hidden"`).
 */
export function MobileMenu({
  children,
  light = false,
  className = "",
  title = "Меню",
}: {
  children: (close: () => void) => React.ReactNode;
  /** White icon, for headers over a video. */
  light?: boolean;
  className?: string;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const close = () => setOpen(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- portal target exists only in the browser
    setMounted(true);
  }, []);
  // A link inside took us elsewhere: the menu goes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- follow navigation
    setOpen(false);
  }, [pathname]);
  // The page under the panel doesn't scroll while it is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
  useEscape(close, open);

  // Inside the admin the panel follows its day/night theme.
  const target = mounted ? document.getElementById("admin-root") ?? document.body : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Открыть меню"
        aria-expanded={open}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md border transition-opacity hover:opacity-80 ${
          light ? "border-white/30 bg-white/5 text-white" : "border-foreground/20 text-foreground"
        } ${className}`}
      >
        <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      {open &&
        target &&
        createPortal(
          <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={title}>
            <div className="absolute inset-0 bg-black/50" onClick={close} />
            <nav className="absolute inset-y-0 right-0 flex w-[85vw] max-w-sm flex-col overflow-y-auto bg-background text-foreground shadow-2xl">
              <div className="flex h-14 shrink-0 items-center justify-between border-b border-foreground/10 px-4">
                <span className="font-semibold">{title}</span>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Закрыть меню"
                  className="flex h-10 w-10 items-center justify-center rounded-md text-xl text-foreground/60 hover:text-foreground"
                >
                  ✕
                </button>
              </div>
              <div className="flex flex-col py-2">{children(close)}</div>
            </nav>
          </div>,
          target
        )}
    </>
  );
}

/** A row of the ☰ panel. */
export const MOBILE_MENU_ITEM =
  "flex min-h-12 w-full items-center px-4 text-left text-base transition-colors hover:bg-foreground/5";
