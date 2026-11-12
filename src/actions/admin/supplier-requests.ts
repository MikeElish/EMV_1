"use server";

import { revalidatePath } from "next/cache";
import { absoluteUrl } from "@/lib/site";
import { sendSiteMail } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";
import { accessDenied, getMyAccess } from "@/lib/access-server";
import { newSupplierQuoteToken, supplierQuoteTokenHash } from "@/lib/supplier-quote";
import { newSupplierInvoiceToken, supplierInvoiceTokenHash } from "@/lib/supplier-invoice-portal";
import { MAX_MONEY_MINOR, parseSupplierCurrency, type SupplierCurrency } from "@/lib/supplier-currency";

export type SupplierRequestData = {
  orders: {
    id: string;
    number: string;
    requestedSupplierIds: string[];
    brands: {
      brand: string;
      productCount: number;
      quantity: number;
      supplierIds: string[];
    }[];
  }[];
  suppliers: { id: string; name: string; hasEmail: boolean }[];
  purchases: {
    id: string;
    lineIds: string[];
    orderNumber: string | null;
    orderNumbers: string[];
    forStock: boolean;
    supplierId: string;
    supplier: string;
    currency: SupplierCurrency;
    amount: number;
    deliveryDays: number | null;
    lines: { name: string; sku: string; quantity: number; price: number; source: string }[];
  }[];
  missingSupplierCount: number;
};

export type SupplierRequestResult =
  | { ok: true; links: { supplier: string; type: "КП" | "Счёт"; url: string }[]; errors: string[] }
  | { ok: false; error: string };

type SelectedQuote = { orderNumber: string; brand: string; supplierId: string };
type SendInput = { quotes: SelectedQuote[]; purchaseLineIds: string[] };

const MAX_SELECTED_LINES = 2000;

function normalizedIds(values: unknown): string[] | null {
  if (!Array.isArray(values) || values.length > MAX_SELECTED_LINES || values.some((value) => typeof value !== "string" || !value || value.length > 200)) {
    return null;
  }
  return [...new Set(values)];
}

function assignmentIsAllowed(
  user: { userId: string; role: string },
  assignments: (string | null)[],
) {
  return user.role === "OWNER" || assignments.every((managerId) => managerId === user.userId);
}

async function buyerOrdersByNumber(orderNumbers: string[]) {
  return orderNumbers.length
    ? prisma.order.findMany({
        where: { orderNumber: { in: orderNumbers } },
        select: {
          id: true,
          orderNumber: true,
          managerId: true,
          items: {
            where: { cancelled: false, status: "CHECKING" },
            select: {
              productId: true,
              quantity: true,
              product: { select: { brand: true, sku: true, name: true } },
            },
          },
        },
      })
    : [];
}

export async function getSupplierRequestData(inputIds: string[]): Promise<
  | { ok: true; data: SupplierRequestData }
  | { ok: false; error: string }
> {
  const denied = await accessDenied("crm.supplier-orders", "view");
  if (denied) return denied;
  const ids = normalizedIds(inputIds);
  if (!ids || ids.length === 0) return { ok: false, error: "Нет позиций для запроса" };
  const me = await getMyAccess();
  if (!me) return { ok: false, error: "Требуется вход" };

  const lines = await prisma.supplierOrderLine.findMany({
    where: { id: { in: ids } },
    include: {
      product: { select: { brand: true } },
      orderItem: { select: { order: { select: { orderNumber: true, managerId: true } } } },
    },
  });
  if (lines.length !== ids.length) return { ok: false, error: "Список позиций изменился. Обновите страницу." };
  const buyerNumbers = [...new Set(lines.map((line) => line.orderItem?.order.orderNumber ?? line.buyerOrderNumber).filter((value): value is string => !!value))];
  const [orders, manualOrders] = await Promise.all([
    buyerOrdersByNumber(buyerNumbers),
    prisma.order.findMany({
      where: { orderNumber: { in: buyerNumbers } },
      select: { orderNumber: true, managerId: true },
    }),
  ]);
  const managerByNumber = new Map(manualOrders.map((order) => [order.orderNumber, order.managerId]));
  const lineAssignments = lines.map((line) => line.orderItem?.order.managerId ?? managerByNumber.get(line.buyerOrderNumber ?? "") ?? null);
  if (!assignmentIsAllowed(me, lineAssignments)) {
    return { ok: false, error: "Запрашивать предложения и заказы можно только по закреплённым за вами заказам" };
  }
  if (orders.some((order) => !assignmentIsAllowed(me, [order.managerId]))) {
    return { ok: false, error: "Запрашивать предложения можно только по закреплённым за вами заказам" };
  }

  const orderIds = orders.map((order) => order.id);
  const allBrands = [...new Set(orders.flatMap((order) => order.items.map((item) => item.product.brand ?? "Без бренда")))];
  const [brandOffers, brandLines, suppliers, requests, eligiblePurchaseLines] = await Promise.all([
    allBrands.length
      ? prisma.supplierOffer.findMany({
          where: {
            supplierId: { not: null },
            product: { brand: { in: allBrands.filter((brand) => brand !== "Без бренда") } },
            supplier: { is: { isOwn: false } },
          },
          orderBy: [{ priceUpdatedAt: "desc" }, { createdAt: "desc" }],
          select: { product: { select: { brand: true } }, supplier: { select: { id: true } } },
        })
      : [],
    allBrands.length
      ? prisma.supplierOrderLine.findMany({
          where: {
            supplierId: { not: null },
            product: { brand: { in: allBrands.filter((brand) => brand !== "Без бренда") } },
            supplier: { is: { isOwn: false } },
          },
          select: { product: { select: { brand: true } }, supplier: { select: { id: true } } },
        })
      : [],
    prisma.company.findMany({
      where: { isOwn: false, OR: [{ type: "Поставщик" }, { supplierOffers: { some: {} } }, { supplierOrderLines: { some: {} } }] },
      select: { id: true, name: true, contactEmail: true },
      orderBy: { name: "asc" },
    }),
    orderIds.length
      ? prisma.priceRequest.findMany({ where: { orderId: { in: orderIds } }, select: { orderId: true, supplierId: true } })
      : [],
    prisma.supplierOrderLine.findMany({
      where: { id: { in: ids }, status: "TO_ORDER", purchaseId: null, supplierId: { not: null } },
      include: {
        product: { select: { name: true, sku: true } },
        supplier: { select: { id: true, name: true } },
        orderItem: { select: { orderId: true, order: { select: { orderNumber: true, managerId: true } } } },
      },
    }),
  ]);

  const supplierIdsByBrand = new Map<string, Set<string>>();
  for (const row of [...brandOffers, ...brandLines]) {
    const brand = row.product.brand ?? "Без бренда";
    if (!row.supplier) continue;
    supplierIdsByBrand.set(brand, (supplierIdsByBrand.get(brand) ?? new Set()).add(row.supplier.id));
  }
  const requestedByOrder = new Map<string, string[]>();
  for (const request of requests) {
    requestedByOrder.set(request.orderId, [...(requestedByOrder.get(request.orderId) ?? []), request.supplierId]);
  }
  const orderData = orders.map((order) => {
    const brands = new Map<string, { productCount: number; quantity: number }>();
    for (const item of order.items) {
      const brand = item.product.brand ?? "Без бренда";
      const existing = brands.get(brand) ?? { productCount: 0, quantity: 0 };
      brands.set(brand, { productCount: existing.productCount + 1, quantity: existing.quantity + item.quantity });
    }
    return {
      id: order.id,
      number: order.orderNumber,
      requestedSupplierIds: [...new Set(requestedByOrder.get(order.id) ?? [])],
      brands: [...brands].map(([brand, totals]) => ({
        brand,
        ...totals,
        supplierIds: [...(supplierIdsByBrand.get(brand) ?? [])],
      })),
    };
  });

  const groups = new Map<string, SupplierRequestData["purchases"][number]>();
  for (const line of eligiblePurchaseLines) {
    if (!line.supplier) continue;
    const currency = parseSupplierCurrency(line.currency) ?? "RUB";
    const orderNumber = line.orderItem?.order.orderNumber ?? line.buyerOrderNumber ?? null;
    const key = JSON.stringify([line.supplier.id, currency]);
    const group = groups.get(key) ?? {
      id: key,
      lineIds: [],
      orderNumber,
      orderNumbers: [],
      forStock: false,
      supplierId: line.supplier.id,
      supplier: line.supplier.name,
      currency,
      amount: 0,
      deliveryDays: line.deliveryDays,
      lines: [],
    };
    if (line.forStock) group.forStock = true;
    if (orderNumber && !group.orderNumbers.includes(orderNumber)) group.orderNumbers.push(orderNumber);
    const price = line.quotedPrice ?? line.price;
    group.amount += price * line.quantity;
    if (line.deliveryDays !== null) {
      group.deliveryDays = group.deliveryDays === null ? line.deliveryDays : Math.max(group.deliveryDays, line.deliveryDays);
    }
    group.lines.push({
      name: line.product.name,
      sku: line.product.sku,
      quantity: line.quantity,
      price,
      source: line.forStock ? "На склад" : orderNumber ? `Заказ № ${orderNumber}` : "Без привязки",
    });
    group.lineIds.push(line.id);
    groups.set(key, group);
  }
  const purchaseAssignments = eligiblePurchaseLines.map(
    (line) => line.orderItem?.order.managerId ?? managerByNumber.get(line.buyerOrderNumber ?? "") ?? null,
  );
  if (!assignmentIsAllowed(me, purchaseAssignments)) {
    return { ok: false, error: "Заказывать можно только позиции по закреплённым за вами заказам" };
  }
  const missingSupplierCount = lines.filter(
    (line) => line.status === "TO_ORDER" && !line.purchaseId && !line.supplierId,
  ).length;

  return {
    ok: true,
    data: {
      orders: orderData,
      suppliers: suppliers.map((supplier) => ({
        id: supplier.id,
        name: supplier.name,
        hasEmail: !!supplier.contactEmail,
      })),
      purchases: [...groups.values()],
      missingSupplierCount,
    },
  };
}

export async function submitSupplierRequests(input: SendInput): Promise<SupplierRequestResult> {
  const denied = await accessDenied("crm.supplier-orders");
  if (denied) return denied;
  if (!input || !Array.isArray(input.quotes) || input.quotes.length > MAX_SELECTED_LINES) {
    return { ok: false, error: "Некорректный список запросов" };
  }
  const purchaseIds = normalizedIds(input.purchaseLineIds);
  if (!purchaseIds) return { ok: false, error: "Некорректный список позиций заказа" };
  const quotes: SelectedQuote[] = [];
  const quoteKeys = new Set<string>();
  for (const quote of input.quotes) {
    if (
      !quote || typeof quote.orderNumber !== "string" || quote.orderNumber.length > 100 ||
      typeof quote.brand !== "string" || !quote.brand || quote.brand.length > 120 ||
      typeof quote.supplierId !== "string" || !quote.supplierId || quote.supplierId.length > 200
    ) {
      return { ok: false, error: "Проверьте выбранные поставщиков и бренды" };
    }
    const key = JSON.stringify([quote.orderNumber, quote.brand, quote.supplierId]);
    if (quoteKeys.has(key)) return { ok: false, error: "В списке есть повторный запрос" };
    quoteKeys.add(key);
    quotes.push(quote);
  }
  if (!quotes.length && !purchaseIds.length) return { ok: false, error: "Выберите поставщиков или заказы" };
  const me = await getMyAccess();
  if (!me) return { ok: false, error: "Требуется вход" };

  const requestedOrderNumbers = [...new Set(quotes.map((quote) => quote.orderNumber))];
  const [orders, suppliers, purchaseLines] = await Promise.all([
    buyerOrdersByNumber(requestedOrderNumbers),
    prisma.company.findMany({
      where: {
        id: { in: [...new Set(quotes.map((quote) => quote.supplierId))] },
        isOwn: false,
        OR: [{ type: "Поставщик" }, { supplierOffers: { some: {} } }, { supplierOrderLines: { some: {} } }],
      },
      select: { id: true, name: true, contactEmail: true, contactName: true },
    }),
    purchaseIds.length
      ? prisma.supplierOrderLine.findMany({
          where: { id: { in: purchaseIds }, status: "TO_ORDER", purchaseId: null },
          include: {
            product: { select: { name: true, sku: true } },
            supplier: { select: { id: true, name: true, contactEmail: true, contactName: true } },
            orderItem: { select: { id: true, orderId: true, order: { select: { orderNumber: true, managerId: true } } } },
          },
        })
      : [],
  ]);
  if (orders.length !== requestedOrderNumbers.length) return { ok: false, error: "Один из заказов не найден или больше не доступен" };
  if (purchaseLines.length !== purchaseIds.length) return { ok: false, error: "Часть позиций уже изменилась. Обновите окно и повторите запрос." };
  const orderByNumber = new Map(orders.map((order) => [order.orderNumber, order]));
  if (!assignmentIsAllowed(me, orders.map((order) => order.managerId))) {
    return { ok: false, error: "Отправлять запросы можно только по закреплённым за вами заказам" };
  }
  const supplierById = new Map(suppliers.map((supplier) => [supplier.id, supplier]));
  if (suppliers.length !== new Set(quotes.map((quote) => quote.supplierId)).size) {
    return { ok: false, error: "Один из выбранных поставщиков не найден" };
  }
  const quoteGroups = new Map<string, { orderId: string; orderNumber: string; supplierId: string; brandSet: Set<string> }>();
  for (const quote of quotes) {
    const order = orderByNumber.get(quote.orderNumber)!;
    if (!order.items.some((item) => (item.product.brand ?? "Без бренда") === quote.brand)) {
      return { ok: false, error: `Бренд «${quote.brand}» больше не входит в заказ ${quote.orderNumber}` };
    }
    const key = JSON.stringify([order.id, quote.supplierId]);
    const group = quoteGroups.get(key) ?? { orderId: order.id, orderNumber: order.orderNumber, supplierId: quote.supplierId, brandSet: new Set<string>() };
    group.brandSet.add(quote.brand);
    quoteGroups.set(key, group);
  }
  const existingRequests = quoteGroups.size
    ? await prisma.priceRequest.findMany({
        where: {
          OR: [...quoteGroups.values()].map((group) => ({ orderId: group.orderId, supplierId: group.supplierId })),
        },
        select: { orderId: true, supplierId: true },
      })
    : [];
  if (existingRequests.length) return { ok: false, error: "Для части поставщиков по этому заказу запрос уже создан" };

  const manualPurchaseOrderNumbers = [...new Set(purchaseLines.map((line) => line.buyerOrderNumber).filter((value): value is string => !!value))];
  const manualPurchaseOrders = manualPurchaseOrderNumbers.length
    ? await prisma.order.findMany({
        where: { orderNumber: { in: manualPurchaseOrderNumbers } },
        select: { id: true, orderNumber: true, managerId: true },
      })
    : [];
  const manualPurchaseManagerByNumber = new Map(manualPurchaseOrders.map((order) => [order.orderNumber, order.managerId]));
  const manualPurchaseOrderByNumber = new Map(manualPurchaseOrders.map((order) => [order.orderNumber, order.id]));
  const purchaseAssignments = purchaseLines.map(
    (line) => line.orderItem?.order.managerId ?? manualPurchaseManagerByNumber.get(line.buyerOrderNumber ?? "") ?? null,
  );
  if (!assignmentIsAllowed(me, purchaseAssignments)) {
    return { ok: false, error: "Отправлять заказы можно только по позициям закреплённых за вами заказов" };
  }
  const purchaseGroups = new Map<string, typeof purchaseLines>();
  for (const line of purchaseLines) {
    if (!line.supplier) return { ok: false, error: `Для артикула ${line.product.sku} не выбран поставщик` };
    if (!line.supplier.contactEmail) return { ok: false, error: `У поставщика «${line.supplier.name}» не указан e-mail` };
    const currency = parseSupplierCurrency(line.currency) ?? "RUB";
    const key = JSON.stringify([line.supplier.id, currency]);
    purchaseGroups.set(key, [...(purchaseGroups.get(key) ?? []), line]);
  }
  for (const group of quoteGroups.values()) {
    const supplier = supplierById.get(group.supplierId);
    if (!supplier?.contactEmail) return { ok: false, error: `У поставщика «${supplier?.name ?? "?"}» не указан e-mail` };
  }

  const links: { supplier: string; type: "КП" | "Счёт"; url: string }[] = [];
  const errors: string[] = [];
  for (const group of quoteGroups.values()) {
    const supplier = supplierById.get(group.supplierId)!;
    const order = orderByNumber.get(group.orderNumber)!;
    const itemsByProduct = new Map<string, number>();
    for (const item of order.items) {
      if (group.brandSet.has(item.product.brand ?? "Без бренда")) {
        itemsByProduct.set(item.productId, (itemsByProduct.get(item.productId) ?? 0) + item.quantity);
      }
    }
    if (!itemsByProduct.size) continue;
    const token = newSupplierQuoteToken();
    const request = await prisma.priceRequest.create({
      data: {
        orderId: group.orderId,
        supplierId: supplier.id,
        email: supplier.contactEmail!,
        contactName: supplier.contactName,
        items: [...itemsByProduct].map(([productId, quantity]) => ({ productId, quantity })),
        tokenHash: supplierQuoteTokenHash(token),
        lines: { create: [...itemsByProduct.keys()].map((productId) => ({ productId })) },
      },
      select: { id: true },
    });
    const url = absoluteUrl(`/supplier-proposal/${token}`);
    let messageId: string;
    try {
      messageId = await sendSiteMail({
        to: supplier.contactEmail!,
        subject: `Запрос КП — заказ ${group.orderNumber}`,
        text: `Добрый день${supplier.contactName ? `, ${supplier.contactName}` : ""}!\n\nПросим предоставить коммерческое предложение по заказу ${group.orderNumber}.\n\nБезопасная ссылка: ${url}`,
      });
    } catch (error) {
      errors.push(
        `Не удалось подтвердить отправку КП для «${supplier.name}», заказ ${group.orderNumber}. Запрос сохранён; проверьте почту перед повторной отправкой. Ссылка: ${url}. ${error instanceof Error ? error.message : ""}`,
      );
      continue;
    }
    links.push({ supplier: supplier.name, type: "КП", url });
    try {
      await prisma.priceRequest.update({ where: { id: request.id }, data: { messageId } });
    } catch (error) {
      errors.push(`КП отправлено поставщику «${supplier.name}», но не удалось сохранить идентификатор письма: ${error instanceof Error ? error.message : "ошибка базы данных"}`);
    }
  }

  for (const lines of purchaseGroups.values()) {
    const first = lines[0];
    const supplier = first.supplier!;
    const currency = parseSupplierCurrency(first.currency) ?? "RUB";
    const orderIds = new Set(
      lines.map((line) =>
        line.forStock
          ? null
          : line.orderItem?.orderId ?? manualPurchaseOrderByNumber.get(line.buyerOrderNumber ?? "") ?? null,
      ),
    );
    const orderId = !lines.some((line) => line.forStock) && orderIds.size === 1
      ? [...orderIds][0] ?? null
      : null;
    const total = lines.reduce((sum, line) => sum + (line.quotedPrice ?? line.price) * line.quantity, 0);
    if (!Number.isSafeInteger(total) || total <= 0 || total > MAX_MONEY_MINOR) {
      errors.push(`Объединённый заказ для «${supplier.name}» (${currency}): сумма превышает допустимую`);
      continue;
    }
    const token = newSupplierInvoiceToken();
    const purchase = await prisma.$transaction(async (tx) => {
      const created = await tx.supplierPurchase.create({
        data: {
          supplierId: supplier.id,
          orderId,
          email: supplier.contactEmail,
          contactName: supplier.contactName,
          invoiceTokenHash: supplierInvoiceTokenHash(token),
        },
        select: { id: true, number: true },
      });
      const updated = await tx.supplierOrderLine.updateMany({
        where: { id: { in: lines.map((line) => line.id) }, status: "TO_ORDER", purchaseId: null },
        data: { purchaseId: created.id },
      });
      if (updated.count !== lines.length) throw new Error("Позиции заказа уже изменились. Обновите окно и повторите.");
      return created;
    });
    const url = absoluteUrl(`/supplier-invoice/${token}`);
    let messageId: string;
    try {
      messageId = await sendSiteMail({
        to: supplier.contactEmail!,
        cc: "emv@emv.one",
        replyTo: "emv@emv.one",
        subject: `Заказ поставщику № ${purchase.number}${currency === "RUB" ? "" : ` (${currency})`}`,
        text: `Добрый день${supplier.contactName ? `, ${supplier.contactName}` : ""}!\n\nПросим предоставить счёт на оплату по заказу поставщику № ${purchase.number}.\n\nБезопасная ссылка: ${url}`,
      });
    } catch (error) {
      errors.push(
        `Не удалось подтвердить отправку заказа № ${purchase.number} поставщику «${supplier.name}». Заказ сохранён; проверьте почту перед повторной отправкой. Ссылка: ${url}. ${error instanceof Error ? error.message : ""}`,
      );
      continue;
    }
    const now = new Date();
    links.push({ supplier: supplier.name, type: "Счёт", url });
    try {
      await prisma.supplierPurchase.update({
        where: { id: purchase.id },
        data: { messageId, sentAt: now },
      });
    } catch (error) {
      errors.push(`Заказ № ${purchase.number} отправлен, но не удалось сохранить идентификатор письма: ${error instanceof Error ? error.message : "ошибка базы данных"}`);
      continue;
    }
    for (const line of lines) {
      if (line.orderItem && line.deliveryDays != null) {
        await prisma.orderItem.update({
          where: { id: line.orderItem.id },
          data: { deliveryDate: new Date(now.getTime() + line.deliveryDays * 24 * 60 * 60 * 1000) },
        });
      }
    }
  }

  revalidatePath("/admin/crm/supplier-orders");
  revalidatePath("/admin/crm/price-check");
  revalidatePath("/admin/warehouse/replenishment");
  return { ok: true, links, errors };
}
