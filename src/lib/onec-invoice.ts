import "server-only";
import { OneCError, oneCGet, oneCSend } from "@/lib/onec";
import { oneCDateTime } from "@/lib/onec-stock";
import { prisma } from "@/lib/prisma";

// «Счет на оплату покупателю» in 1С:Бухгалтерия, written by the site and
// posted, so its number is 1С's. Header settings (bank account, title,
// responsible, VAT rate) are copied from the latest invoice the accountant
// made; the buyer's contract is the one named on the site, else its main one.

const q = encodeURIComponent;
const EMPTY = "00000000-0000-0000-0000-000000000000";
const INVOICE = "Document_СчетНаОплатуПокупателю";
const ITEM_TYPE = "StandardODATA.Catalog_Номенклатура";

type TemplateLine = { Номенклатура: string; СтавкаНДС: string };
type Template = Record<string, unknown> & { Товары: TemplateLine[] };

const HEADER_FIELDS = [
  "Организация_Key",
  "ОрганизацияПолучатель_Key",
  "СтруктурнаяЕдиница_Key",
  "Ответственный_Key",
  "ВалютаДокумента_Key",
  "КратностьВзаиморасчетов",
  "КурсВзаиморасчетов",
  "СуммаВключаетНДС",
  "ДополнительныеУсловия_Key",
  "ЗаголовокСчета_Key",
  "ВидОперации",
] as const;

async function template(): Promise<Template> {
  const filter = q("DeletionMark eq false and Posted eq true");
  const r = await oneCGet<{ value: Template[] }>(`/${q(INVOICE)}?$filter=${filter}&$orderby=${q("Date desc")}&$top=1`);
  const t = r.value[0];
  if (!t?.Товары?.length) throw new OneCError("В 1С нет ни одного проведённого счёта покупателю, с которого взять настройки");
  return t;
}

/** VAT rate of the 1С line («НДС22») → percent, null without VAT. */
export const vatPercent = (rate: string) => (/\d+/.test(rate) && !/Без/i.test(rate) ? Number(rate.match(/\d+/)![0]) : null);

/** The buyer in 1С: the company's link, else found by ИНН (and remembered). */
export async function counterpartyRef(company: { id: string; oneCRef: string | null; inn: string | null; name: string }): Promise<string> {
  if (company.oneCRef) return company.oneCRef;
  if (company.inn) {
    const r = await oneCGet<{ value: { Ref_Key: string }[] }>(
      `/${q("Catalog_Контрагенты")}?$filter=${q(`ИНН eq '${company.inn}' and DeletionMark eq false`)}&$select=Ref_Key`
    );
    const ref = r.value[0]?.Ref_Key;
    if (ref) {
      await prisma.company.update({ where: { id: company.id }, data: { oneCRef: ref } }).catch(() => {});
      return ref;
    }
  }
  throw new OneCError(`«${company.name}» нет в 1С (контрагент с ИНН ${company.inn ?? "—"} не найден) — заведите его в 1С`);
}

/** The buyer's (or supplier's) contract: the one whose number the site has, else «Основной договор» (created if there is none). */
export async function contractRef(
  owner: string,
  org: string,
  currency: string,
  number: string | null,
  kind: "СПокупателем" | "СПоставщиком" = "СПокупателем"
): Promise<string> {
  const filter = q(`Owner_Key eq guid'${owner}' and ВидДоговора eq '${kind}' and DeletionMark eq false`);
  const r = await oneCGet<{ value: { Ref_Key: string; Description: string; Номер: string }[] }>(
    `/${q("Catalog_ДоговорыКонтрагентов")}?$filter=${filter}&$select=Ref_Key,Description,Номер`
  );
  const bare = (s: string) => s.replace(/^№\s*/, "").split(/\s+от\s+/)[0].trim();
  const named = number ? r.value.find((c) => bare(c.Номер || c.Description) === bare(number)) : undefined;
  const found = named ?? r.value.find((c) => /основной/i.test(c.Description)) ?? r.value[0];
  if (found) return found.Ref_Key;
  const created = await oneCSend<{ Ref_Key: string }>("POST", `/${q("Catalog_ДоговорыКонтрагентов")}`, {
    Description: "Основной договор",
    Owner_Key: owner,
    Организация_Key: org,
    ВидДоговора: kind,
    ВалютаВзаиморасчетов_Key: currency,
  });
  return created.Ref_Key;
}

/** The product's 1С item: its link, else a new item made like the one on the latest invoice. */
export async function itemRef(product: { id: string; sku: string; name: string }, sample: string): Promise<string> {
  const link = await prisma.oneCProductLink.findFirst({ where: { productId: product.id }, select: { ref: true } });
  if (link) return link.ref;
  const card = await oneCGet<Record<string, string>>(
    `/${q("Catalog_Номенклатура")}(guid'${sample}')?$select=ВидНоменклатуры_Key,ЕдиницаИзмерения_Key,НоменклатурнаяГруппа_Key,ВидСтавкиНДС,Parent_Key`
  );
  const created = await oneCSend<{ Ref_Key: string }>("POST", `/${q("Catalog_Номенклатура")}`, {
    Description: product.name.slice(0, 100),
    НаименованиеПолное: product.name,
    Артикул: product.sku.slice(0, 25),
    ВидНоменклатуры_Key: card.ВидНоменклатуры_Key,
    ЕдиницаИзмерения_Key: card.ЕдиницаИзмерения_Key,
    НоменклатурнаяГруппа_Key: card.НоменклатурнаяГруппа_Key,
    ВидСтавкиНДС: card.ВидСтавкиНДС,
    Parent_Key: card.Parent_Key ?? EMPTY,
  });
  await prisma.oneCProductLink.create({ data: { ref: created.Ref_Key, productId: product.id } });
  return created.Ref_Key;
}

export type OneCInvoiceLine = { product: { id: string; sku: string; name: string }; quantity: number; /** kopecks */ price: number };
export type OneCInvoice = { ref: string; number: string; date: Date; vatRate: number | null; vat: number };

/**
 * Writes the invoice (a new one, or `ref` again with the new lines) and posts
 * it. Returns 1С's number without the prefix («НФНФ-000590» → «590»).
 */
export async function saveOneCInvoice(input: {
  ref: string | null;
  buyer: string;
  contractNumber: string | null;
  lines: OneCInvoiceLine[];
  comment: string;
}): Promise<OneCInvoice> {
  const t = await template();
  const rate = t.Товары[0].СтавкаНДС;
  const percent = vatPercent(rate);
  const header = Object.fromEntries(HEADER_FIELDS.filter((f) => t[f] !== undefined).map((f) => [f, t[f]]));
  const org = String(t.Организация_Key);
  const contract = await contractRef(input.buyer, org, String(t.ВалютаДокумента_Key), input.contractNumber);

  let vat = 0;
  const lines = [];
  for (const [i, l] of input.lines.entries()) {
    const sum = l.price * l.quantity;
    const lineVat = percent ? Math.round((sum * percent) / (100 + percent)) : 0;
    vat += lineVat;
    lines.push({
      LineNumber: String(i + 1),
      Номенклатура: await itemRef(l.product, t.Товары[0].Номенклатура),
      Номенклатура_Type: ITEM_TYPE,
      Количество: l.quantity,
      Цена: l.price / 100,
      Сумма: sum / 100,
      СтавкаНДС: rate,
      СуммаНДС: lineVat / 100,
    });
  }
  const body = {
    ...header,
    Контрагент_Key: input.buyer,
    ДоговорКонтрагента_Key: contract,
    СуммаДокумента: input.lines.reduce((s, l) => s + l.price * l.quantity, 0) / 100,
    Товары: lines,
  };

  // Rewriting an invoice keeps its date and the accountant's comment.
  let ref = input.ref;
  if (ref) await oneCSend("PATCH", `/${q(INVOICE)}(guid'${ref}')`, body);
  else
    ref = (
      await oneCSend<{ Ref_Key: string }>("POST", `/${q(INVOICE)}`, { ...body, Комментарий: input.comment, Date: oneCDateTime(new Date()) })
    ).Ref_Key;
  await oneCSend("POST", `/${q(INVOICE)}(guid'${ref}')/Post?PostingModeOperational=false`);
  const saved = await oneCGet<{ Number: string; Date: string }>(`/${q(INVOICE)}(guid'${ref}')?$select=Number,Date`);
  return {
    ref,
    number: String(Number(saved.Number.replace(/\D/g, "")) || saved.Number.trim()),
    // 1С keeps Moscow wall time without a zone.
    date: new Date(`${saved.Date}+03:00`),
    vatRate: percent,
    vat,
  };
}
