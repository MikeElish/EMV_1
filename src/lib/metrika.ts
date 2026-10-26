import { METRIKA_ID } from "@/lib/site";

type Ym = (id: number, method: string, ...args: unknown[]) => void;

function ym(method: string, ...args: unknown[]) {
  const fn = (window as unknown as { ym?: Ym }).ym;
  if (typeof fn === "function") fn(METRIKA_ID, method, ...args);
}

/**
 * A goal in Яндекс.Метрика (Цели → «JavaScript-событие» with this
 * identifier): order, register.
 */
export function reachGoal(goal: string, params?: Record<string, unknown>) {
  ym("reachGoal", goal, params);
}

/**
 * An order placed: goal «order» with its sum, and the purchase in
 * Электронная коммерция (the counter reads window.dataLayer). Prices in kopecks.
 */
export function trackPurchase(
  orderNumber: string,
  totalKopecks: number,
  items: { sku: string; name: string; price: number; quantity: number }[]
) {
  const w = window as unknown as { dataLayer?: unknown[] };
  w.dataLayer = w.dataLayer ?? [];
  w.dataLayer.push({
    ecommerce: {
      currencyCode: "RUB",
      purchase: {
        actionField: { id: orderNumber, revenue: totalKopecks / 100 },
        products: items.map((i) => ({ id: i.sku, name: i.name, price: i.price / 100, quantity: i.quantity })),
      },
    },
  });
  reachGoal("order", { order_price: totalKopecks / 100, currency: "RUB" });
}

/** A page view after a client-side navigation (Metrika sees only the first load by itself). */
export function trackPageView(url: string, referer: string) {
  ym("hit", url, { referer });
}
