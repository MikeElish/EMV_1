"use client";

import { useEffect, useState } from "react";

// What the Windows program (desktop/src/preload.js) adds to the page as
// window.emvDesktop. Absent in a normal browser.

export type DesktopPriceFile = {
  id: string;
  name: string;
  /** Name of the subfolder the file was dropped into (Прайсы\<Поставщик>\), if any. */
  supplier: string | null;
  data: Uint8Array;
};

export type EmvDesktop = {
  isDesktop: true;
  /** Prints a file of the site (PDF or image) on the printer chosen in the program, without a dialog. */
  printFile(url: string, name: string): Promise<{ ok: true } | { ok: false; error: string }>;
  /** The window's Масштаб, percent (50–200); since program 1.1.2. */
  zoom?: {
    get(): Promise<number>;
    set(percent: number): Promise<number>;
    /** Changed elsewhere (the program's settings, Ctrl + wheel); returns the unsubscribe. */
    onChange(callback: (percent: number) => void): () => void;
  };
  prices: {
    /** The next price list from the watched folder, null when none is waiting. */
    next(): Promise<DesktopPriceFile | null>;
    /** imported: the file goes to «Загружено»; otherwise it waits for the next time. */
    finish(id: string, imported: boolean): Promise<void>;
    /** Called when files are waiting -- right away if some already are; returns the unsubscribe. */
    onAvailable(callback: () => void): () => void;
  };
};

declare global {
  interface Window {
    emvDesktop?: EmvDesktop;
  }
}

/**
 * A supplier's subfolder name in the price-list folder: Windows forbids some
 * characters (ООО "Ромашка" → ООО _Ромашка_). Same rule as desktop/src/prices.js.
 */
export function supplierFolderName(name: string) {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/[. ]+$/, "").trim();
}

/** The program's bridge after mount (null in a browser and during SSR). */
export function useDesktop(): EmvDesktop | null {
  const [desktop, setDesktop] = useState<EmvDesktop | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- window exists only after mount
    setDesktop(window.emvDesktop?.isDesktop ? window.emvDesktop : null);
  }, []);
  return desktop;
}
