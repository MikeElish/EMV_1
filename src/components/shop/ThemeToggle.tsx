"use client";

import { useLayoutEffect, useState } from "react";
import { THEME_SCOPES, type ThemeScope } from "@/lib/theme";

type Theme = "light" | "dark";

function applyTheme(scope: ThemeScope, theme: Theme) {
  const { rootId, attribute } = THEME_SCOPES[scope];
  document.getElementById(rootId)?.setAttribute(attribute, theme);
}

// Same fallback as the layouts' inline init scripts -- kept here too because
// those only run on a hard page load. A client-side navigation into the
// section mounts this component without ever running the inline script, so
// this is what restores the saved theme (or the default) in that case.
function readStoredTheme(scope: ThemeScope): Theme {
  try {
    const stored = localStorage.getItem(THEME_SCOPES[scope].storageKey);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // ignore unavailable storage
  }
  if (scope === "admin") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "dark";
}

export function ThemeToggle({ light = false, scope = "shop" }: { light?: boolean; scope?: ThemeScope }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useLayoutEffect(() => {
    const resolved = readStoredTheme(scope);
    applyTheme(scope, resolved);
    setTheme(resolved);
  }, [scope]);

  function toggle() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    applyTheme(scope, next);
    try {
      localStorage.setItem(THEME_SCOPES[scope].storageKey, next);
    } catch {
      // ignore storage write failures (private mode, quota, etc.)
    }
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Включить светлую тему" : "Включить тёмную тему"}
      title={isDark ? "Светлая тема" : "Тёмная тема"}
      aria-pressed={isDark}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors ${
        light
          ? "border-white/30 text-white hover:bg-white/10"
          : "border-foreground/20 text-foreground hover:bg-foreground/5"
      }`}
    >
      {isDark ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="4.5" fill="currentColor" />
          <g stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
            <path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.55 1.55M6.85 17.15L5.3 18.7M18.7 18.7l-1.55-1.55M6.85 6.85L5.3 5.3" />
          </g>
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
          <path
            d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"
            fill="currentColor"
          />
        </svg>
      )}
    </button>
  );
}
