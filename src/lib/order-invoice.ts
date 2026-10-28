import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { counterpartyRef, saveOneCInvoice } from "@/lib/onec-invoice";
import { renderInvoicePdf, type InvoiceData } from "@/lib/invoice-pdf";
import { deleteOrderDocumentFile, uploadOrderDocumentFile } from "@/lib/order-document-storage";
import { deliveryMethodFromNote } from "@/lib/delivery";

// «Счет на оплату» of an order: written to 1С (its number), printed from the
// shop's template into a PDF and put into the order's «Счета». A new one for
// the same order rewrites the same 1С document and replaces the file.

/** Самовывоз: the shop's warehouse. */
export const PICKUP_ADDRESS = "Санкт-Петербург, г. Павловск, СНТ «Павловское-2», 10-я линия, д.11, стр.1";
/** In stock: days to hand it over. */
const IN_STOCK_DAYS = 2;

const TERMS_4_7 = [
  "4. Гарантийный срок на поставляемый Товар составляет 6 (шесть) месяцев с момента перехода права собственности. Под гарантийным случаем признаётся преждевременный выход из строя Товара, возникший в результате производственного дефекта или нарушения технологии изготовления. Качество Товара: {quality}",
  "5. Обмен и(или) возврат Товара, без выявленных заводских дефектов и выхода из строя при условиях, поставленного в установленный срок специально под заказ для нужд Покупателя, может быть осуществлен только по взаимному соглашению Сторон.",
  "6. Обмену и(или) возврату Товар не подлежит, если: имеют механические повреждения и(или) следы эксплуатации (установки) Товара; Товар был заказана без серийного (заводского) номера техники по информации (артикул, каталожный номер Товара) полученной от Покупателя; повреждение возникло по вине владельца, не соблюдавшего правила эксплуатации и/или хранения Товара; установка Товара или ремонт был произведён с нарушениями требований производителя, в том числе лицами, не имеющими соответствующей квалификации и допуска; в конструкцию Товара, а также агрегата, на котором он установлен или смежных систем, прямо или косвенно влияющих на его работу, были внесены изменения, не предусмотренные изготовителем, или изменения были выполнены без соблюдения технических требований изготовителя, что повлекло или могло повлечь за собой выход Товара из строя; имело место использование деталей, аксессуаров или технических жидкостей, не рекомендованных производителем и/или по своим техническим характеристикам, не подходящим для использования совместно с Товаром, что повлекло или могло повлечь за собой выход Товара из строя; имело место самостоятельное устранение причины неисправности Товара, его разборка, сборка, пайка, вскрытие пломб, дефектовка, смена рабочих жидкостей и другие действия, после проведения которых установить причину неисправности невозможно.",
  "7. Поставщик не несет ответственности за ущерб, нанесенный имуществу Покупателя, в случае если установка и(или) использование Товара производилось Покупателем в нарушение условий п. 6 и(или) правил завода изготовителя по эксплуатации и(или) ремонту техники (оборудования). Упущенная выгода возмещению не подлежит.",
];

const BLANK = "____";
const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
/** «21 сентября 2026 г.» in Moscow time. */
function dateText(date: Date) {
  const [y, m, d] = date.toLocaleDateString("sv-SE", { timeZone: "Europe/Moscow" }).split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y} г.`;
}

/** «Населённый пункт: …\nУлица: …» of the checkout → one line of address. */
function noteAddress(note: string | null) {
  const pick = (label: string) => note?.match(new RegExp(`${label}: ([^\\n]+)`))?.[1]?.trim();
  return [pick("Населённый пункт"), pick("Улица"), pick("Дом") && `д. ${pick("Дом")}`, pick("Офис/квартира") && `оф./кв. ${pick("Офис/квартира")}`]
    .filter(Boolean)
    .join(", ");
}

export type Terms = {
  prepay: boolean;
  contract: boolean;
  days: number | null;
  deferralDays: number | null;
  quality: string | null;
  method: "ADDRESS" | "TERMINAL" | "PICKUP";
  address: string;
};

/** The numbered terms: the shop's template, with the three wordings of 1–3 (предоплата / отсрочка с договором / без). */
export function termsText(t: Terms): string[] {
  const days = t.days ?? BLANK;
  const lines = t.prepay
    ? [
        "1. Покупатель до начала поставки производит платёж (предоплата) в размере не менее 100 % от общей стоимости поставки, а Поставщика поставляет Товар в установленные настоящей спецификацией.",
        `2. Срок поставки: в течение ${days} календарных дней с момента поступления денежных средств на расчетный счет Поставщика.`,
        "3.Отгрузка товара осуществляется после поступления на расчетный счет Поставщика 100% денежных средств от стоимости Товара.",
      ]
    : [
        "1. Покупатель до начала поставки производит платёж (предоплата) в размере 0 % от общей стоимости поставки, а Поставщика поставляет Товар в установленные настоящей спецификацией.",
        t.contract
          ? `2. Срок поставки: в течение ${days} календарных дней с момента поступления акцепта от Покупателя.`
          : `2. Срок поставки: в течение ${days} календарных дней с момента подписания договора поставки и поступления акцепта от Покупателя.`,
        `3.Отгрузка товара осуществляется на условии отсрочки платежа ${t.deferralDays ?? BLANK} календарных дней с момента поступления Товара на склад Покупателя.`,
      ];
  const delivery =
    t.method === "PICKUP"
      ? [`8. Адрес поставки: ${PICKUP_ADDRESS}`, `9. Самовывоз: ${PICKUP_ADDRESS}`]
      : [
          `8. Адрес поставки: ${t.address || BLANK}`,
          `9. Доставка: ${t.method === "TERMINAL" ? `до терминала транспортной компании${t.address ? ` (${t.address})` : ""}` : "до адреса Покупателя"}`,
        ];
  return [...lines, ...TERMS_4_7.map((s) => s.replace("{quality}", t.quality ?? "______")), ...delivery];
}

export type IssuedInvoice = { number: string; fileName: string; fileUrl: string };

export async function issueOrderInvoice(orderId: string): Promise<IssuedInvoice> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        where: { cancelled: false },
        orderBy: { id: "asc" },
        include: {
          product: { select: { id: true, sku: true, name: true, stock: true, offers: { where: { selected: true }, select: { deliveryDays: true, quality: true } } } },
          offer: { select: { deliveryDays: true, quality: true } },
        },
      },
      user: { select: { company: true } },
    },
  });
  if (!order) throw new Error("Заказ не найден");
  if (!order.items.length) throw new Error("В заказе нет позиций");
  const company =
    order.user?.company ??
    (await prisma.company.findFirst({ where: { name: { equals: order.customerName, mode: "insensitive" }, isOwn: false } }));
  if (!company) throw new Error(`Покупатель «${order.customerName}» не найден среди компаний — счёт выставляется компании`);
  if (order.items.some((i) => i.priceSnapshot <= 0)) throw new Error("В заказе есть позиции без цены (По запросу) — сначала укажите цены");

  // Срок: in stock -- 2 days; otherwise the supplier's term plus those 2 days.
  const needed = new Map<string, number>();
  for (const i of order.items) needed.set(i.productId, (needed.get(i.productId) ?? 0) + i.quantity);
  let days: number | null = IN_STOCK_DAYS;
  const qualities = new Set<string>();
  for (const i of order.items) {
    const offer = i.offer ?? i.product.offers[0] ?? null;
    if (offer?.quality) qualities.add(offer.quality);
    if (i.product.stock >= (needed.get(i.productId) ?? 0)) continue;
    if (offer?.deliveryDays == null) days = null;
    else if (days !== null) days = Math.max(days, offer.deliveryDays + IN_STOCK_DAYS);
  }

  const contractNumber = company.hasContract && company.contract ? company.contract.replace(/^№\s*/, "").trim() : null;
  const saved = await saveOneCInvoice({
    ref: order.invoiceRef,
    buyer: await counterpartyRef(company),
    contractNumber,
    lines: order.items.map((i) => ({ product: i.product, quantity: i.quantity, price: i.priceSnapshot })),
    comment: `Заказ ${order.orderNumber} с сайта emv.one`,
  });

  const method = deliveryMethodFromNote(order.deliveryNote) ?? "PICKUP";
  const terminal = order.deliveryNote?.match(/Терминал: ([^\n]+)/)?.[1]?.trim() ?? "";
  const total = order.items.reduce((s, i) => s + i.priceSnapshot * i.quantity, 0);
  const data: InvoiceData = {
    number: saved.number,
    dateText: dateText(saved.date),
    buyer: [company.name, company.inn && `ИНН ${company.inn}`, company.kpp && `КПП ${company.kpp}`, company.address].filter(Boolean).join(",  "),
    basis: contractNumber ? `Договор: ${contractNumber}` : `Заказ № ${order.orderNumber}`,
    lines: order.items.map((i) => ({
      sku: i.product.sku,
      name: i.nameSnapshot,
      quantity: i.quantity,
      unit: "шт",
      price: i.priceSnapshot,
      sum: i.priceSnapshot * i.quantity,
    })),
    vatRate: saved.vatRate,
    vat: saved.vat,
    total,
    terms: termsText({
      prepay: company.paymentType !== "DEFERRED",
      contract: company.hasContract,
      days,
      deferralDays: company.paymentDeferralDays,
      quality: qualities.size ? [...qualities].join(", ") : null,
      method,
      address: method === "TERMINAL" ? terminal : noteAddress(order.deliveryNote) || (company.address ?? ""),
    }),
  };
  const pdf = await renderInvoicePdf(data);
  const fileName = `Счет на оплату № ${saved.number} от ${data.dateText}.pdf`;

  // The previous file of this invoice goes.
  const old = await prisma.orderDocument.findMany({
    where: { orderId, category: "INVOICE", fileName: { startsWith: `Счет на оплату № ${saved.number} от` } },
  });
  for (const d of old) {
    await deleteOrderDocumentFile(d.fileUrl);
    await prisma.orderDocument.delete({ where: { id: d.id } });
  }
  const fileUrl = await uploadOrderDocumentFile(orderId, "INVOICE", pdf, fileName);
  await prisma.$transaction([
    prisma.orderDocument.create({ data: { orderId, category: "INVOICE", fileName, fileUrl } }),
    prisma.order.update({
      where: { id: orderId },
      data: { invoiceRef: saved.ref, invoiceNumber: saved.number, invoiceDate: saved.date },
    }),
  ]);
  revalidatePath("/admin/crm/orders");
  return { number: saved.number, fileName, fileUrl };
}
