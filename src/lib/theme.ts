// Manual light/dark switch, per section. The shop defaults to dark; the
// admin follows the OS until the button is pressed. Used by ThemeToggle and
// by the layouts' inline scripts that set the attribute before first paint.
export const THEME_SCOPES = {
  shop: { storageKey: "shop-theme", rootId: "shop-root", attribute: "data-shop-theme" },
  admin: { storageKey: "admin-theme", rootId: "admin-root", attribute: "data-admin-theme" },
} as const;

export type ThemeScope = keyof typeof THEME_SCOPES;

/** Inline script setting the theme attribute before paint on a full page load. */
export function themeInitScript(scope: ThemeScope) {
  const { storageKey, rootId, attribute } = THEME_SCOPES[scope];
  const fallback =
    scope === "admin" ? "matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'" : "'dark'";
  return `(function(){try{var t=localStorage.getItem('${storageKey}');if(t!=='light'&&t!=='dark'){t=${fallback};}document.getElementById('${rootId}').setAttribute('${attribute}',t);}catch(e){}})();`;
}
