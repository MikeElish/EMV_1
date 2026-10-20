// CRM → Товары remembers where the list was when a product card is opened,
// so «Назад» (or saving the card) lands on the same filters and scroll spot.
export const PRODUCTS_RETURN_KEY = "crm-products-return";

export type ProductsReturnState = { filters: Record<string, string>; scrollTop: number; at: number };

export function saveProductsPlace(filters: Record<string, string>, scrollTop: number) {
  try {
    const state: ProductsReturnState = { filters, scrollTop, at: Date.now() };
    sessionStorage.setItem(PRODUCTS_RETURN_KEY, JSON.stringify(state));
  } catch {
    // ignore unavailable storage
  }
}
