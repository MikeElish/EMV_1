/** Lightweight product shape used in the shop catalog lists.
 *  Keeping this small keeps the shop homepage payload small. */
export type ShopCatalogProduct = {
  id: string;
  sku: string;
  name: string;
  slug: string;
  price: number;
  stock: number;
  partnerStock: number;
  brand: string | null;
  categoryId: string;
  newArrivalAt: Date;
};
