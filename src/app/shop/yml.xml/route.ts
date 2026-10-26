import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { companyInfo } from "@/content/company";
import { absoluteUrl, productHeading, SHOP_NAME } from "@/lib/site";

// The catalog for Яндекс Товары / Яндекс Бизнес (YML): the shop reads it
// by itself, so prices and stock there follow the site.
export const dynamic = "force-dynamic";

const xml = (value: string) =>
  value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

/** Offer ids: Latin letters and digits, at most 20 — stable for a product. */
const offerId = (productId: string) => BigInt(`0x${createHash("sha1").update(productId).digest("hex").slice(0, 24)}`).toString(36).slice(0, 20);

/** «2026-10-26T15:04+03:00» — the feed's date in Moscow time. */
function feedDate(date: Date) {
  const msk = new Date(date.getTime() + 3 * 3600_000).toISOString();
  return `${msk.slice(0, 16)}+03:00`;
}

export async function GET() {
  const [categories, products] = await Promise.all([
    prisma.category.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.product.findMany({
      where: { isActive: true, price: { gt: 0 }, category: { isActive: true } },
      orderBy: { name: "asc" },
    }),
  ]);
  // YML wants numeric category ids.
  const categoryNumber = new Map(categories.map((c, i) => [c.id, i + 1]));

  const offers = products.map((p) => {
    const lines = [
      `<offer id="${offerId(p.id)}" available="${p.stock > 0}">`,
      `<name>${xml(productHeading(p))}</name>`,
      p.brand ? `<vendor>${xml(p.brand)}</vendor>` : "",
      `<vendorCode>${xml(p.sku)}</vendorCode>`,
      `<url>${xml(absoluteUrl(`/shop/product/${p.slug}`))}</url>`,
      `<price>${(p.price / 100).toFixed(2)}</price>`,
      `<currencyId>RUR</currencyId>`,
      `<categoryId>${categoryNumber.get(p.categoryId)}</categoryId>`,
      ...p.images.slice(0, 10).map((src) => `<picture>${xml(absoluteUrl(src))}</picture>`),
      p.description ? `<description>${xml(p.description.slice(0, 3000))}</description>` : "",
      `<count>${Math.max(p.stock, 0)}</count>`,
      `</offer>`,
    ];
    return lines.filter(Boolean).join("");
  });

  const body = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<yml_catalog date="${feedDate(new Date())}">`,
    `<shop>`,
    `<name>${xml(SHOP_NAME)}</name>`,
    `<company>${xml(companyInfo.legalName)}</company>`,
    `<url>${xml(absoluteUrl("/shop"))}</url>`,
    `<currencies><currency id="RUR" rate="1"/></currencies>`,
    `<categories>`,
    ...categories.map((c) => `<category id="${categoryNumber.get(c.id)}">${xml(c.name)}</category>`),
    `</categories>`,
    `<offers>`,
    ...offers,
    `</offers>`,
    `</shop>`,
    `</yml_catalog>`,
  ].join("\n");

  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
