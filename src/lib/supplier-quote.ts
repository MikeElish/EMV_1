import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { parseSupplierCurrency, type SupplierCurrency } from "@/lib/supplier-currency";

export type SupplierQuoteRow = {
  productId: string;
  brand: string | null;
  sku: string;
  name: string;
  quantity: number;
  price: number | null;
  currency: SupplierCurrency;
  exchangeRate: number | null;
  logisticsMarkupPercent: number;
  noOffer: boolean;
  inStock: boolean;
  stockQuantity: number | null;
  quality: string;
  warehouse: string;
  deliveryDays: string;
};

export type SupplierQuoteContext = {
  requestId: string;
  supplierId: string;
  supplierName: string;
  orderId: string;
  orderNumber: string;
  managerEmail: string | null;
  managerNotifiedAt: Date | null;
  rows: SupplierQuoteRow[];
};

export function newSupplierQuoteToken(): string {
  return randomBytes(32).toString("base64url");
}

export function supplierQuoteTokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function loadSupplierQuote(token: string): Promise<SupplierQuoteContext | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const request = await prisma.priceRequest.findUnique({
    where: { tokenHash: supplierQuoteTokenHash(token) },
    include: {
      supplier: { select: { id: true, name: true } },
      order: {
        select: {
          id: true,
          orderNumber: true,
          manager: { select: { email: true, login: true } },
          items: {
            where: { cancelled: false, status: "CHECKING" },
            select: { productId: true, quantity: true },
          },
        },
      },
      lines: { include: { product: { select: { id: true, brand: true, sku: true, name: true } } } },
    },
  });
  if (!request) return null;

  const quantityByProduct = new Map<string, number>();
  for (const item of request.order.items) {
    quantityByProduct.set(item.productId, (quantityByProduct.get(item.productId) ?? 0) + item.quantity);
  }
  const activeProducts = request.lines.filter((line) => quantityByProduct.has(line.productId));
  if (!activeProducts.length) {
    return {
      requestId: request.id,
      supplierId: request.supplierId,
      supplierName: request.supplier.name,
      orderId: request.order.id,
      orderNumber: request.order.orderNumber,
      managerEmail: null,
      managerNotifiedAt: request.managerNotifiedAt,
      rows: [],
    };
  }
  const offers = await prisma.supplierOffer.findMany({
    where: {
      supplierId: request.supplierId,
      productId: { in: activeProducts.map((line) => line.productId) },
    },
    orderBy: { priceUpdatedAt: "desc" },
    select: {
      productId: true,
      price: true,
      quotedPrice: true,
      currency: true,
      exchangeRate: true,
      logisticsMarkupPercent: true,
      noOffer: true,
      inStock: true,
      stockQuantity: true,
      quality: true,
      warehouse: true,
      deliveryDays: true,
    },
  });
  const offerByProduct = new Map<string, (typeof offers)[number]>();
  for (const offer of offers) if (!offerByProduct.has(offer.productId)) offerByProduct.set(offer.productId, offer);
  const managerLogin = request.order.manager?.login;

  return {
    requestId: request.id,
    supplierId: request.supplierId,
    supplierName: request.supplier.name,
    orderId: request.order.id,
    orderNumber: request.order.orderNumber,
    managerEmail:
      request.order.manager?.email ??
      (managerLogin && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(managerLogin) ? managerLogin : null),
    managerNotifiedAt: request.managerNotifiedAt,
    rows: activeProducts.map((line) => {
      const offer = offerByProduct.get(line.productId);
      return {
        productId: line.productId,
        brand: line.product.brand,
        sku: line.product.sku,
        name: line.product.name,
        quantity: quantityByProduct.get(line.productId)!,
        price: offer && !offer.noOffer ? (offer.quotedPrice ?? offer.price) : null,
        currency: parseSupplierCurrency(offer?.currency) ?? "RUB",
        exchangeRate: offer?.exchangeRate ?? 1,
        logisticsMarkupPercent: offer?.logisticsMarkupPercent ?? 0,
        noOffer: offer?.noOffer ?? false,
        inStock: offer?.inStock ?? false,
        stockQuantity: offer?.stockQuantity ?? null,
        quality: offer?.quality ?? "",
        warehouse: offer?.warehouse ?? "",
        deliveryDays: offer?.deliveryDays == null ? "" : String(offer.deliveryDays),
      };
    }),
  };
}
