/** Effective CSS zoom of an element (product of its ancestors' zoom), 1 where unsupported. */
export function cssZoomOf(element: Element): number {
  const zoom = (element as Element & { currentCSSZoom?: number }).currentCSSZoom;
  return typeof zoom === "number" && zoom > 0 ? zoom : 1;
}
