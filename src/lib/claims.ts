import "server-only";
import path from "path";
import { readFile } from "fs/promises";
import { prisma } from "@/lib/prisma";
import { sendSiteMail } from "@/lib/mailer";
import { absoluteUrl } from "@/lib/site";
import { SHOP_MAILBOX } from "@/lib/price-requests";

// Возврат / рекламация: the letters around a claim. The shop's mailbox hears
// of a new one, the customer of each decision, the supplier of a defect.

const claimWithOrder = {
  order: { select: { orderNumber: true, customerName: true, customerEmail: true } },
  orderItem: { select: { nameSnapshot: true, quantity: true, priceSnapshot: true, product: { select: { id: true, sku: true, brand: true } } } },
} as const;

async function loadClaim(id: string) {
  const claim = await prisma.claim.findUnique({ where: { id }, include: claimWithOrder });
  if (!claim) throw new Error("Рекламация не найдена");
  return claim;
}

const describe = (c: Awaited<ReturnType<typeof loadClaim>>) =>
  `${c.orderItem.nameSnapshot}${c.orderItem.product?.sku ? ` (арт. ${c.orderItem.product.sku})` : ""}, ${c.quantity} шт.`;

/** A new claim: to the shop's mailbox, with a link to CRM. */
export async function notifyNewClaim(id: string) {
  const c = await loadClaim(id);
  await sendSiteMail({
    to: SHOP_MAILBOX,
    subject: `Рекламация № ${c.number} — заказ ${c.order.orderNumber}`,
    text: [
      `Новая заявка «${c.reason}» от ${c.order.customerName}${c.order.customerEmail ? ` (${c.order.customerEmail})` : ""}.`,
      `Заказ ${c.order.orderNumber}: ${describe(c)}`,
      "",
      c.description,
      "",
      c.photos.length ? `Фото: ${c.photos.length}` : "Без фото",
      `Открыть: ${absoluteUrl("/admin/crm/claims")}`,
    ].join("\n"),
  });
}

/** The decision, to the customer. */
export async function notifyClaimStatus(id: string) {
  const c = await loadClaim(id);
  if (!c.order.customerEmail) return;
  await sendSiteMail({
    to: c.order.customerEmail,
    subject: `Рекламация № ${c.number}: ${c.status.toLowerCase()}`,
    text: [
      "Здравствуйте!",
      "",
      `По вашей заявке № ${c.number} (заказ ${c.order.orderNumber}, ${describe(c)}) статус: «${c.status}».`,
      c.resolution ? `Решение: ${c.resolution}.` : "",
      c.answer ? `\n${c.answer}` : "",
      "",
      `Заявки видны в «Мои заказы»: ${absoluteUrl("/shop/orders")}`,
    ]
      .filter((l, i, all) => l || all[i - 1])
      .join("\n"),
  });
}

/**
 * A defect, to the supplier the product was bought from (the card's
 * supplier, else the chosen offer's): the photos attached, a copy to the shop.
 */
export async function sendSupplierClaim(id: string): Promise<string> {
  const c = await loadClaim(id);
  const productId = c.orderItem.product?.id;
  if (!productId) throw new Error("У позиции нет товара в каталоге");
  const [pricing, offer] = await Promise.all([
    prisma.productPricing.findUnique({ where: { productId }, select: { supplier: true } }),
    prisma.supplierOffer.findFirst({ where: { productId, selected: true, supplierId: { not: null } }, select: { supplier: true } }),
  ]);
  const supplier = pricing?.supplier ?? offer?.supplier;
  if (!supplier) throw new Error("Неизвестно, у какого поставщика куплен товар");
  if (!supplier.contactEmail) throw new Error(`В карточке «${supplier.name}» нет e-mail для запросов`);

  const attachments = [];
  for (const [i, url] of c.photos.entries()) {
    const content = await readFile(path.join(process.cwd(), "public", url)).catch(() => null);
    if (content) attachments.push({ filename: `Фото ${i + 1}${path.extname(url)}`, content });
  }
  await sendSiteMail({
    to: supplier.contactEmail,
    cc: SHOP_MAILBOX,
    replyTo: SHOP_MAILBOX,
    subject: `Рекламация: ${c.orderItem.product?.brand ?? ""} ${c.orderItem.product?.sku ?? ""}`.trim(),
    text: [
      supplier.contactName ? `Добрый день, ${supplier.contactName}!` : "Добрый день!",
      "",
      `Покупатель обнаружил дефект товара: ${describe(c)}.`,
      "",
      `Описание: ${c.description}`,
      "",
      attachments.length ? "Фото во вложении." : "",
      "Просим рассмотреть рекламацию и сообщить о решении (замена, возврат денежных средств) ответным письмом.",
      "",
      "Заранее благодарим!",
    ].join("\n"),
    attachments,
  });
  await prisma.claim.update({ where: { id }, data: { supplierClaimAt: new Date() } });
  return supplier.name;
}
