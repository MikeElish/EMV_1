export function priceWithSupplierLogistics(price: number, percent: number): number {
  return Math.round(price * (1 + percent / 100));
}
