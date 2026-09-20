"use client";

import { useEffect, useState } from "react";

const TRANSITION_MS = 200;

export function Modal({
  onClose,
  children,
  maxWidthClassName = "max-w-md",
}: {
  onClose: () => void;
  children: React.ReactNode;
  maxWidthClassName?: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  function close() {
    setVisible(false);
    setTimeout(onClose, TRANSITION_MS);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      onClick={close}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[80vh] w-[90vw] ${maxWidthClassName} flex-col overflow-y-auto rounded-lg bg-background p-6 shadow-xl transition-all duration-200 ${
          visible ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Закрыть"
          className="ml-auto text-foreground/40 hover:text-foreground"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}
