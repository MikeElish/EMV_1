import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { parseSupplierCurrency, type SupplierCurrency } from "@/lib/supplier-currency";

export function newSupplierInvoiceToken(): string {
  return randomBytes(32).toString("base64url");
}

export function supplierInvoiceTokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function loadSupplierInvoice(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const purchase = await prisma.supplierPurchase.findUnique({
    where: { invoiceTokenHash: supplierInvoiceTokenHash(token) },
    include: {
      supplier: { select: { name: true } },
      order: { select: { orderNumber: true } },
      paymentRequest: { select: { id: true } },
      lines: {
        include: {
          product: { select: { name: true, sku: true } },
          orderItem: { select: { order: { select: { orderNumber: true } } } },
        },
        orderBy: { id: "asc" },
      },
    },
  });
  if (!purchase) return null;

  const currencies = new Set(purchase.lines.map((line) => parseSupplierCurrency(line.currency) ?? "RUB"));
  if (currencies.size > 1) throw new Error(`В заказе поставщику № ${purchase.number} смешаны валюты`);
  const currency: SupplierCurrency = parseSupplierCurrency(purchase.lines[0]?.currency) ?? "RUB";
  return {
    number: purchase.number,
    supplierName: purchase.supplier.name,
    orderNumber: purchase.order?.orderNumber ?? null,
    invoiceAt: purchase.invoiceAt?.toISOString() ?? null,
    hasPaymentRequest: purchase.paymentRequest !== null,
    currency,
    total: purchase.lines.reduce(
      (sum, line) => sum + (currency === "RUB" ? line.price : line.quotedPrice ?? line.price) * line.quantity,
      0,
    ),
    lines: purchase.lines.map((line) => ({
      name: line.product.name,
      sku: line.product.sku,
      quantity: line.quantity,
      price: currency === "RUB" ? line.price : line.quotedPrice ?? line.price,
      source: line.forStock
        ? "На склад"
        : line.orderItem?.order.orderNumber
          ? `Заказ № ${line.orderItem.order.orderNumber}`
          : line.buyerOrderNumber
            ? `Заказ № ${line.buyerOrderNumber}`
            : "Без привязки",
    })),
  };
}
