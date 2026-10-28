"use client";

import { useEffect, useState } from "react";
import { useDesktop } from "@/lib/desktop";

/**
 * Настройки → Сайт: the Windows program's Масштаб. Shown only inside the
 * program (a browser zooms on its own); the same setting as the slider in
 * the program's Файл → Настройки.
 */
export function DesktopZoomSlider() {
  const zoomApi = useDesktop()?.zoom;
  const [zoom, setZoom] = useState<number | null>(null);

  useEffect(() => {
    if (!zoomApi) return;
    zoomApi.get().then(setZoom);
    return zoomApi.onChange(setZoom);
  }, [zoomApi]);

  if (!zoomApi || zoom === null) return null;

  function change(value: number) {
    setZoom(value);
    zoomApi?.set(value);
  }

  return (
    <div className="mt-4 border-t border-foreground/10 pt-3">
      <label htmlFor="desktop-zoom" className="text-sm font-medium">
        Масштаб в программе
      </label>
      <div className="mt-1 flex items-center gap-3">
        <input
          id="desktop-zoom"
          type="range"
          min={50}
          max={200}
          step={10}
          value={zoom}
          onChange={(e) => change(Number(e.target.value))}
          className="min-w-0 flex-1 accent-foreground"
        />
        <span className="w-12 text-right text-sm tabular-nums">{zoom}%</span>
        <button
          type="button"
          onClick={() => change(100)}
          className="rounded-md border border-foreground/20 px-3 py-1 text-sm hover:bg-foreground/5"
        >
          100%
        </button>
      </div>
      <p className="mt-1 text-xs text-foreground/50">Меняется сразу. Также Ctrl+колёсико мыши, Ctrl+= и Ctrl+−.</p>
    </div>
  );
}
