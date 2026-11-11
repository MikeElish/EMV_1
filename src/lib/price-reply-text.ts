export type RequestedPriceProduct = {
  id: string;
  sku: string;
  name: string;
};

export type PriceReplyCandidate = {
  productId: string;
  sku: string;
  name: string;
  price: number;
  deliveryDays: number | null;
};

const NO_OFFER = /(?<![\p{L}\p{N}])(?:нет\s+(?:в\s+наличии|на\s+складе|предложени\p{L}*|возможности\s+(?:поставки|поставить))|не\s+(?:можем|сможем)\s+(?:поставить|предложить|обеспечить)|(?:поставить|предложить)\s+не\s+(?:можем|сможем)|не\s+(?:поставля\p{L}*|прода[её]м)|отсутству\p{L}*|снят\p{L}*\s+с\s+производства)/iu;
const NO_OFFER_FOR_ALL = /(?<![\p{L}\p{N}])(?:по\s+(?:вашему\s+)?запросу\s+(?:предложени\p{L}*\s+)?нет|по\s+запрошенн\p{L}*\s+позици\p{L}*\s+предложени\p{L}*\s+нет|не\s+(?:можем|сможем)\s+(?:поставить|предложить)\s+(?:запрошенн\p{L}*\s+)?(?:позици\p{L}*|товар\p{L}*|ничего)|нет\s+возможности\s+поставить\s+запрошенн\p{L}*)/iu;

export function requestedPriceProductIds(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return [
    ...new Set(
      items.flatMap((item) =>
        item &&
        typeof item === "object" &&
        "productId" in item &&
        typeof item.productId === "string"
          ? [item.productId]
          : [],
      ),
    ),
  ];
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Returns requested products explicitly refused by SKU, or all on a clear blanket refusal. */
export function noOfferPriceProductIds(
  text: string,
  products: RequestedPriceProduct[],
): string[] {
  const lines = text
    .split(/\r?\n|[.!?]\s+(?=[\p{L}\p{N}])/u)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.some((line) => NO_OFFER_FOR_ALL.test(line))) {
    return products.map((product) => product.id);
  }

  return products
    .filter((product) => {
      const sku = skuPattern(product.sku);
      return lines.some((line) => {
        sku.lastIndex = 0;
        return sku.test(line) && NO_OFFER.test(line);
      });
    })
    .map((product) => product.id);
}

const PRICE_NUMBER = String.raw`(?:\d{1,3}(?:[\s\u00a0]\d{3})+(?:[,.]\d{1,2})?|\d+(?:[,.]\d{1,2})?)`;
const RUB = String.raw`(?:₽|руб(?:ля|лей)?\.?|р\.?|RUB)`;
const PRICE = new RegExp(
  String.raw`(?:${RUB}\s*(${PRICE_NUMBER})|(${PRICE_NUMBER})\s*${RUB})`,
  "giu",
);

function skuPattern(sku: string): RegExp {
  const parts = sku.trim().split(/[\s./\\_-]+/).filter(Boolean);
  if (!parts.length) return /$a/;
  const body = parts.map(escapeRegex).join(String.raw`[\s./\\_-]*`);
  return new RegExp(
    String.raw`(?<![\p{L}\p{N}])${body}(?![\p{L}\p{N}])`,
    "giu",
  );
}

function numericValue(value: string): number | null {
  const parsed = Number(value.replace(/[\s\u00a0]/g, "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : null;
}

function priceMatches(line: string) {
  const matches: { start: number; end: number; value: number }[] = [];
  PRICE.lastIndex = 0;
  for (const match of line.matchAll(PRICE)) {
    const value = numericValue(match[1] ?? match[2] ?? "");
    if (value !== null) {
      matches.push({ start: match.index!, end: match.index! + match[0].length, value });
    }
  }
  return matches;
}

function deliveryDays(line: string): number | null {
  const match = line.match(/(\d{1,3})\s*(?:рабоч(?:их|ий|ие)\s*)?(?:дн(?:я|ей)?\.?)/i);
  return match ? Number(match[1]) : null;
}

/**
 * Suggests prices only when a requested SKU and a ruble amount occur together
 * on one line. Conflicting amounts for the same product are left for manual
 * review in the original message rather than guessed.
 */
export function analyzePriceReplyText(
  text: string,
  products: RequestedPriceProduct[],
): PriceReplyCandidate[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const candidates: PriceReplyCandidate[] = [];

  for (const product of products) {
    const sku = skuPattern(product.sku);
    const matches = new Map<number, number | null>();

    for (const line of lines) {
      const skuMatches = [...line.matchAll(sku)];
      if (!skuMatches.length) continue;

      const prices = priceMatches(line);
      for (const skuMatch of skuMatches) {
        const skuStart = skuMatch.index!;
        const skuEnd = skuStart + skuMatch[0].length;
        const nearby = prices.filter((price) => {
          const overlaps =
            price.start < skuEnd && price.end > skuStart;
          const distance = Math.min(
            Math.abs(price.start - skuEnd),
            Math.abs(skuStart - price.end),
          );
          return !overlaps && distance <= 100;
        });
        if (nearby.length === 1) {
          matches.set(nearby[0].value, deliveryDays(line));
        }
      }
    }

    if (matches.size !== 1) continue;
    const [[price, days]] = matches;
    candidates.push({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      price,
      deliveryDays: days,
    });
  }

  return candidates;
}

export function findFreeDeliveryTerm(text: string): string | null {
  const clause = text.match(
    /(?:бесплатн\p{L}*\s+доставк\p{L}*|доставк\p{L}*[^.!?\n]{0,60}бесплатн\p{L}*)[^.!?\n]*/iu,
  )?.[0];
  if (!clause) return null;

  const threshold = clause.match(
    /от\s+(?:суммы|заказа|покупки)?\s*(\d[\d\s\u00a0]*(?:[,.]\d{1,2})?)\s*(?:₽|руб(?:ля|лей)?\.?|р\.?|RUB)/iu,
  )?.[1];
  const amount = threshold?.replace(/[\s\u00a0]/g, "").replace(",", ".");
  return amount
    ? `Бесплатная доставка от ${new Intl.NumberFormat("ru-RU").format(Number(amount))} ₽`
    : clause.trim().replace(/\s+/g, " ").slice(0, 200);
}
