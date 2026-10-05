"use client";

import { createContext, useContext, useEffect } from "react";
import { usePathname } from "next/navigation";
import { sectionOfPath, type AccessLevel, type AccessMap } from "@/lib/access";

// The signed-in employee's levels from Карточка пользователя → Доступ, for
// menus, tabs and the «только просмотр» mode.

const AccessContext = createContext<AccessMap | null>(null);

export function AccessProvider({ access, children }: { access: AccessMap; children: React.ReactNode }) {
  const pathname = usePathname();
  const section = sectionOfPath(pathname);
  const level: AccessLevel = section ? access[section.key] ?? "hide" : "edit";

  // On the admin root so windows opened in a portal follow it too (globals.css).
  useEffect(() => {
    const root = document.getElementById("admin-root");
    if (root) root.dataset.access = level;
  }, [level]);

  return <AccessContext.Provider value={access}>{children}</AccessContext.Provider>;
}

/** Null outside the admin: everything is open there. */
export function useAccessMap(): AccessMap | null {
  return useContext(AccessContext);
}

/** Hidden sections drop out of menus and tabs. */
export function useVisible(): (href: string) => boolean {
  const access = useAccessMap();
  return (href) => {
    const section = sectionOfPath(href);
    return !access || !section || access[section.key] !== "hide";
  };
}

export function ViewOnlyBanner() {
  const access = useAccessMap();
  const section = sectionOfPath(usePathname());
  if (!access || !section || access[section.key] !== "view") return null;
  return (
    <p className="mb-4 shrink-0 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
      Режим просмотра: изменения в разделе «{section.label}» недоступны.
    </p>
  );
}
