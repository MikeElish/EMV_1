"use client";

import { useEscape } from "@/lib/use-escape";
import { useEffect, useId, useRef, useState } from "react";
import { ThemedPortal } from "@/components/ThemedPortal";
import { useWindowMinimization } from "@/components/WindowMinimizationProvider";

const TRANSITION_MS = 200;
let latestModalLayer = 50;

export function Modal({
  onClose,
  children,
  maxWidthClassName = "max-w-md",
  widthClassName = "w-[90vw]",
  maxHeightClassName = "max-h-[80vh]",
  title,
  dismissible = true,
}: {
  onClose: () => void;
  children: React.ReactNode;
  maxWidthClassName?: string;
  widthClassName?: string;
  maxHeightClassName?: string;
  title?: string;
  /** false: no ✕, Esc and a click outside do nothing -- the content decides. */
  dismissible?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [layer, setLayer] = useState(50);
  const [minimized, setMinimized] = useState(false);
  const id = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const { registerWindow, unregisterWindow } = useWindowMinimization();

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setLayer(++latestModalLayer);
      setVisible(true);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => () => unregisterWindow(id), [id, unregisterWindow]);

  function close() {
    if (!dismissible) return;
    unregisterWindow(id);
    setVisible(false);
    setTimeout(onClose, TRANSITION_MS);
  }

  function minimize() {
    const windowTitle =
      title?.trim() ||
      panelRef.current?.querySelector("h1, h2, h3")?.textContent?.trim() ||
      "Окно";
    setMinimized(true);
    registerWindow({
      id,
      title: windowTitle,
      restore: () => {
        setLayer(++latestModalLayer);
        setMinimized(false);
      },
      close,
    });
  }

  // Esc closes the window on top (see useEscape).
  useEscape(close, !minimized);

  // Rendered at the section root: a modal opened from a FitWidth-scaled
  // table must not shrink with it.
  return (
    <ThemedPortal>
      <div
        onClick={close}
        hidden={minimized}
        aria-hidden={minimized}
        inert={minimized}
        style={{ zIndex: layer }}
        className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm transition-opacity duration-200 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        <div
          ref={panelRef}
          onClick={(e) => e.stopPropagation()}
          className={`flex ${maxHeightClassName} ${widthClassName} ${maxWidthClassName} flex-col overflow-y-auto rounded-lg bg-background p-6 shadow-xl transition-all duration-200 ${
            visible ? "scale-100 opacity-100" : "scale-95 opacity-0"
          }`}
        >
          {dismissible && (
            <div className="-mb-1 -mr-1 -mt-2 flex shrink-0 justify-end gap-1">
              <button
                type="button"
                onClick={minimize}
                aria-label="Свернуть"
                title="Свернуть"
                className="rounded px-2 text-lg leading-none text-foreground/40 hover:bg-foreground/10 hover:text-foreground"
              >
                _
              </button>
              <button
                type="button"
                onClick={close}
                aria-label="Закрыть"
                title="Закрыть"
                className="rounded px-2 text-foreground/40 hover:bg-foreground/10 hover:text-foreground"
              >
                ✕
              </button>
            </div>
          )}
          {children}
        </div>
      </div>
    </ThemedPortal>
  );
}
