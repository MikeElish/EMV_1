import "server-only";
import path from "path";
import { readFile } from "fs/promises";
import { prisma } from "@/lib/prisma";
import { oneCGet } from "@/lib/onec";
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

// ---- «Возврат от покупателя» in 1С, by hand for now ------------------------------

const q = encodeURIComponent;
const RETURN_DOC = "Document_ВозвратТоваровОтПокупателя";

/** Whether 1С has any customer return yet: until it does, the site can't copy its settings. */
export async function oneCHasCustomerReturn(): Promise<boolean> {
  const r = await oneCGet<{ value: unknown[] }>(`/${q(RETURN_DOC)}?$top=1&$select=Ref_Key`);
  return r.value.length > 0;
}

type Sale = { Ref_Key: string; Number: string; Date: string; Склад_Key: string; ДоговорКонтрагента_Key: string; Товары?: SaleLine[] };
// Реализация names the item Номенклатура_Key (a счёт -- Номенклатура).
type SaleLine = { Номенклатура_Key?: string; Номенклатура?: string; Количество: number; Цена: number };
const lineItem = (t: SaleLine) => t.Номенклатура_Key ?? t.Номенклатура ?? "";

/** The 1С shipment of the claimed line: the one made on the order's invoice, else the buyer's latest with that item. */
async function shipmentOf(invoiceRef: string | null, buyerRef: string | null, itemRefs: string[]): Promise<Sale | null> {
  const select = "$select=Ref_Key,Number,Date,Склад_Key,ДоговорКонтрагента_Key,Товары";
  const filters = [
    invoiceRef && `СчетНаОплатуПокупателю_Key eq guid'${invoiceRef}' and DeletionMark eq false`,
    buyerRef && `Контрагент_Key eq guid'${buyerRef}' and DeletionMark eq false and Posted eq true`,
  ].filter(Boolean) as string[];
  for (const filter of filters) {
    const r = await oneCGet<{ value: Sale[] }>(
      `/${q("Document_РеализацияТоваровУслуг")}?$filter=${q(filter)}&$orderby=${q("Date desc")}&${select}`
    );
    const sale = r.value.find((s) => !itemRefs.length || s.Товары?.some((t) => itemRefs.includes(lineItem(t))));
    if (sale) return sale;
  }
  return null;
}

async function description(entity: string, ref: string | null | undefined): Promise<string | null> {
  if (!ref || ref.startsWith("00000000")) return null;
  const r = await oneCGet<{ Description?: string }>(`/${q(entity)}(guid'${ref}')?$select=Description`).catch(() => null);
  return r?.Description?.trim() || null;
}

/**
 * A claim accepted while 1С has no customer return yet: the owner gets what
 * to make in 1С by hand -- the shipment to base it on, the buyer, contract,
 * warehouse, item, quantity, price -- and how. Once that first return is
 * posted, the site can make the next ones like it.
 */
export async function sendManualReturnLetter(id: string): Promise<boolean> {
  if (await oneCHasCustomerReturn()) return false;
  const c = await prisma.claim.findUnique({
    where: { id },
    include: {
      order: { select: { orderNumber: true, customerName: true, invoiceRef: true, invoiceNumber: true, invoiceDate: true, user: { select: { company: true } } } },
      orderItem: { select: { nameSnapshot: true, priceSnapshot: true, productId: true, product: { select: { sku: true } } } },
    },
  });
  if (!c) return false;
  const company =
    c.order.user?.company ??
    (await prisma.company.findFirst({ where: { name: { equals: c.order.customerName, mode: "insensitive" }, isOwn: false } }));
  const itemRefs = (await prisma.oneCProductLink.findMany({ where: { productId: c.orderItem.productId }, select: { ref: true } })).map((l) => l.ref);
  const sale = await shipmentOf(c.order.invoiceRef, company?.oneCRef ?? null, itemRefs).catch(() => null);
  const [warehouse, contract, item] = await Promise.all([
    description("Catalog_Склады", sale?.Склад_Key),
    description("Catalog_ДоговорыКонтрагентов", sale?.ДоговорКонтрагента_Key),
    description("Catalog_Номенклатура", itemRefs[0]),
  ]);
  const saleLine = sale?.Товары?.find((t) => itemRefs.includes(lineItem(t)));
  const price = saleLine ? saleLine.Цена : c.orderItem.priceSnapshot / 100;
  const day = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("ru-RU");
  const rub = (n: number) => n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const text = [
    `Рекламация № ${c.number} принята (${c.reason}${c.resolution ? `, решение: ${c.resolution}` : ""}).`,
    "Сайт пока не создаёт в 1С возвраты от покупателей: в базе ещё нет ни одного такого документа, с которого взять настройки.",
    "Создайте, пожалуйста, этот возврат в 1С вручную — после него следующие сайт сможет делать сам.",
    "",
    "ДАННЫЕ ДЛЯ ДОКУМЕНТА",
    `Документ: Возврат товаров от покупателя (вид операции «Товары»)`,
    `Покупатель: ${company?.name ?? c.order.customerName}${company?.inn ? `, ИНН ${company.inn}` : ""}${company?.kpp ? `, КПП ${company.kpp}` : ""}`,
    `Договор: ${contract ?? (company?.contract ? company.contract : "основной договор покупателя")}`,
    sale ? `Документ реализации (основание): Реализация № ${sale.Number.trim()} от ${day(sale.Date)}` : "Документ реализации: на сайте не найден — выберите реализацию этого товара покупателю",
    `Склад: ${warehouse ?? "Основной склад"}`,
    `Счёт на оплату: ${c.order.invoiceNumber ? `№ ${c.order.invoiceNumber}${c.order.invoiceDate ? ` от ${c.order.invoiceDate.toLocaleDateString("ru-RU")}` : ""}` : "—"}, заказ на сайте ${c.order.orderNumber}`,
    "",
    "Товар:",
    `  ${item ?? c.orderItem.nameSnapshot}${c.orderItem.product?.sku ? ` (арт. ${c.orderItem.product.sku})` : ""}`,
    `  Количество: ${c.quantity} шт.`,
    `  Цена: ${rub(price)} руб. ${saleLine ? "(как в реализации)" : "(как в заказе на сайте — сверьте с реализацией)"}`,
    `  Сумма: ${rub(price * c.quantity)} руб.`,
    "",
    `Причина возврата: ${c.reason}. ${c.description}`,
    "",
    "КАК СОЗДАТЬ В 1С:БУХГАЛТЕРИИ",
    sale
      ? `1. Продажи → Реализация (акты, накладные, УПД) → откройте № ${sale.Number.trim()} от ${day(sale.Date)}.`
      : "1. Продажи → Реализация (акты, накладные, УПД) → найдите реализацию этого товара покупателю.",
    "2. Кнопка «Создать на основании» → «Возврат товаров от покупателя» — шапка (покупатель, договор, склад) заполнится сама.",
    `3. В табличной части «Товары» оставьте только эту позицию и поставьте количество ${c.quantity}. Счета учёта и себестоимость 1С подставит из реализации — не меняйте их.`,
    "4. Дата — день фактического возврата товара на склад.",
    "5. «Провести и закрыть».",
    c.resolution === "Возврат денег"
      ? "6. Деньги: Банк и касса → Банковские выписки → «Списание» с видом операции «Возврат покупателю», основание — этот возврат."
      : c.resolution === "Зачёт в следующий заказ"
        ? "6. Деньги не возвращаются: сумма остаётся авансом покупателя и зачтётся в следующей реализации."
        : c.resolution === "Замена товара"
          ? "6. Замена: новый товар отгрузите отдельной реализацией по тому же договору."
          : "6. Как вернуть деньги — по решению в рекламации на сайте (CRM → Рекламации).",
    "",
    "Склад и «Наличие» на сайте подтянутся из 1С при ближайшей синхронизации (06:00 / 18:00) или по кнопке «Обновить остатки сейчас» в Настройки → 1С.",
    `Рекламация на сайте: ${absoluteUrl("/admin/crm/claims")}`,
  ].join("\n");

  await sendSiteMail({ to: SHOP_MAILBOX, subject: `Создайте в 1С возврат по рекламации № ${c.number} (заказ ${c.order.orderNumber})`, text });
  return true;
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
