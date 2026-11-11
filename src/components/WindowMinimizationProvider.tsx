"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type MinimizedWindow = {
  id: string;
  title: string;
  originPath: string;
  minimized: boolean;
  restore: () => void;
  close: () => void;
};

type WindowMinimizationContextValue = {
  hasMinimizedWindows: boolean;
  persistentPaths: string[];
  registerWindow: (window: MinimizedWindow) => void;
  unregisterWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
};

const WindowMinimizationContext =
  createContext<WindowMinimizationContextValue | null>(null);

export function WindowMinimizationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [windows, setWindows] = useState<MinimizedWindow[]>([]);

  const registerWindow = useCallback((window: MinimizedWindow) => {
    setWindows((current) => [
      ...current.filter((item) => item.id !== window.id),
      window,
    ]);
  }, []);

  const unregisterWindow = useCallback((id: string) => {
    setWindows((current) => current.filter((window) => window.id !== id));
  }, []);
  const restoreWindow = useCallback((id: string) => {
    const window = windows.find((item) => item.id === id);
    if (!window) return;
    window.restore();
    setWindows((current) =>
      current.map((item) =>
        item.id === id ? { ...item, minimized: false } : item,
      ),
    );
  }, [windows]);
  const contextValue = useMemo(
    () => ({
      hasMinimizedWindows: windows.some((window) => window.minimized),
      persistentPaths: [...new Set(windows.map((window) => window.originPath))],
      registerWindow,
      unregisterWindow,
      restoreWindow,
    }),
    [registerWindow, restoreWindow, unregisterWindow, windows],
  );

  return (
    <WindowMinimizationContext.Provider
      value={contextValue}
    >
      {children}
      {windows.some((window) => window.minimized) && (
        <aside
          aria-label="Свёрнутые окна"
          className="fixed bottom-4 right-4 z-[2147483647] flex max-h-[50vh] w-72 flex-col gap-2 overflow-y-auto rounded-xl border border-white/10 bg-neutral-900 p-2 text-white shadow-2xl"
        >
          {windows.filter((window) => window.minimized).map((window) => (
            <div
              key={window.id}
              className="flex min-w-0 items-center gap-1 rounded-lg bg-white/10"
            >
              <button
                type="button"
                onClick={() => {
                  restoreWindow(window.id);
                }}
                aria-label={`Восстановить: ${window.title}`}
                title={`Восстановить: ${window.title}`}
                className="min-w-0 flex-1 truncate px-3 py-2 text-left text-sm hover:bg-white/10"
              >
                {window.title}
              </button>
              <button
                type="button"
                onClick={() => {
                  window.close();
                  unregisterWindow(window.id);
                }}
                aria-label={`Закрыть: ${window.title}`}
                title={`Закрыть: ${window.title}`}
                className="shrink-0 rounded px-2 py-1 text-white/60 hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>
          ))}
        </aside>
      )}
    </WindowMinimizationContext.Provider>
  );
}

export function useWindowMinimization() {
  const context = useContext(WindowMinimizationContext);
  if (!context) {
    throw new Error(
      "useWindowMinimization must be used within WindowMinimizationProvider",
    );
  }
  return context;
}
