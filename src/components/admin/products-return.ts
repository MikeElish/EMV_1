// CRM → Товары remembers where the list was when a product card is opened,
// so «Назад» (or saving the card) lands on the same search and scroll spot.
export const PRODUCTS_RETURN_KEY = "crm-products-return";

export type ProductsReturnState = { search: string; scrollTop: number; at: number };

export function saveProductsPlace(search: string, scrollTop: number) {
  try {
    const state: ProductsReturnState = { search, scrollTop, at: Date.now() };
    sessionStorage.setItem(PRODUCTS_RETURN_KEY, JSON.stringify(state));
  } catch {
    // ignore unavailable storage
  }
}
