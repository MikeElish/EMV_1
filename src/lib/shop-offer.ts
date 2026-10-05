/** A supplier offer as the shop sees it: no supplier, no purchase price. */
export type ShopOffer = { id: string; quality: string | null; price: number; deliveryDays: number | null; main: boolean };
