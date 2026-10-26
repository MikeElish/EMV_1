import { slugifySku } from "@/lib/slug";

/** The public address of the site: sitemap, canonical links, the YML feed. */
export const SITE_URL = (process.env.SITE_URL ?? "https://emv.one").replace(/\/+$/, "");

export const SHOP_NAME = "EMV Запчасти";
export const SHOP_CITY = "Санкт-Петербург";
/** «в Санкт-Петербурге» for titles. */
export const SHOP_CITY_IN = "в Санкт-Петербурге";

export const METRIKA_ID = 105596920;

export const absoluteUrl = (path: string) => `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

/**
 * URL part of a brand page: «JOHN DEERE» → john-deere, «KÄRCHER» → karcher.
 * Accents are dropped first so umlauts don't split the word.
 */
export function brandSlug(brand: string): string {
  return slugifySku(brand.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ø/gi, "o").replace(/&/g, " and "));
}

/** «1 позиция», «4 позиции», «12 позиций». */
export function positions(count: number): string {
  const n = Math.abs(count) % 100;
  const word = n % 10 === 1 && n !== 11 ? "позиция" : n % 10 >= 2 && n % 10 <= 4 && (n < 12 || n > 14) ? "позиции" : "позиций";
  return `${count} ${word}`;
}

/**
 * «Обойма подшипника CATERPILLAR 2D9454» — what people type into the search;
 * the brand and article are added only when the name lacks them.
 */
export function productHeading(product: { name: string; brand: string | null; sku: string }) {
  const name = product.name.toLowerCase();
  const brand = product.brand && !name.includes(product.brand.toLowerCase()) ? ` ${product.brand}` : "";
  const sku = name.includes(product.sku.toLowerCase()) ? "" : ` ${product.sku}`;
  return `${product.name}${brand}${sku}`;
}

/** «12 345 ₽» for meta descriptions (prices are kopecks). */
export const rubText = (kopecks: number) => `${Math.round(kopecks / 100).toLocaleString("ru-RU").replace(/ /g, " ")} ₽`;
