import "server-only";
import { OneCError, oneCGet, oneCSend } from "@/lib/onec";
import { oneCDateTime } from "@/lib/onec-stock";
import { contractRef, itemRef, vatPercent } from "@/lib/onec-invoice";
import { createPosted, units } from "@/lib/onec-stock-docs";

// «Реализация (акт, накладная, УПД)» in 1С:Бухгалтерия when goods leave
// (Склад → Выдача), with its «Счет-фактура выданный» -- the УПД's number is
// the invoice's. Header and line accounts from the latest posted Реализация;
// a prepayment is offset automatically on 62.02; the order's «Счет на оплату»
// is its basis.

const q = encodeURIComponent;
const SALE = "Document_РеализацияТоваровУслуг";
const SALE_TYPE = "StandardODATA.Document_РеализацияТоваровУслуг";
const TAX_INVOICE = "Document_СчетФактураВыданный";
const EMPTY = "00000000-0000-0000-0000-000000000000";

type TemplateLine = Record<string, unknown> & { Номенклатура_Key: string; СтавкаНДС: string };
type Template = Record<string, unknown> & { Товары: TemplateLine[] };

const HEADER_FIELDS = [
  "Организация_Key",
  "Склад_Key",
  "ВалютаДокумента_Key",
  "КурсВзаиморасчетов",
  "КратностьВзаиморасчетов",
  "СчетУчетаРасчетовСКонтрагентом_Key",
  "БанковскийСчетОрганизации_Key",
  "Ответственный_Key",
  "Руководитель_Key",
  "ГлавныйБухгалтер_Key",
  "ВидЭлектронногоДокумента",
] as const;

const LINE_ACCOUNTS = ["СчетУчета_Key", "СчетДоходов_Key", "СчетУчетаНДСПоРеализации_Key", "СчетРасходов_Key"] as const;

async function template(): Promise<Template> {
  const filter = q("DeletionMark eq false and Posted eq true and ВидОперации eq 'Товары'");
  const r = await oneCGet<{ value: Template[] }>(`/${q(SALE)}?$filter=${filter}&$orderby=${q("Date desc")}&$top=1`);
  const t = r.value[0];
  if (!t?.Товары?.length) throw new OneCError("В 1С нет ни одной проведённой реализации товаров, с которой взять настройки");
  return t;
}

export type SaleLine = { product: { id: string; sku: string; name: string }; quantity: number; /** kopecks, with VAT */ price: number };

export type OneCSale = {
  saleRef: string;
  saleNumber: string;
  /** The УПД's number: the Счет-фактура's («181»). */
  number: string;
  date: Date;
  vatRate: number | null;
  /** kopecks per line */
  lineVat: number[];
};

const shortNumber = (n: string) => String(Number(n.replace(/\D/g, "")) || n.trim());

export async function createOneCSale(input: {
  buyer: string;
  contractNumber: string | null;
  invoiceRef: string | null;
  lines: SaleLine[];
  comment: string;
}): Promise<OneCSale> {
  if (!input.lines.length) throw new OneCError("Нет позиций для реализации");
  const t = await template();
  const sample = t.Товары[0];
  const header = Object.fromEntries(HEADER_FIELDS.filter((f) => t[f] !== undefined).map((f) => [f, t[f]]));
  const org = String(t.Организация_Key);
  const currency = String(t.ВалютаДокумента_Key);

  // The VAT of the order's invoice (it may be an older rate), else the template's.
  let rate = sample.СтавкаНДС;
  if (input.invoiceRef) {
    const invoice = await oneCGet<{ Товары?: { СтавкаНДС: string }[] }>(`/${q("Document_СчетНаОплатуПокупателю")}(guid'${input.invoiceRef}')?$select=Товары`).catch(() => null);
    rate = invoice?.Товары?.[0]?.СтавкаНДС || rate;
  }
  const percent = vatPercent(rate);

  const [contract, chart] = await Promise.all([
    contractRef(input.buyer, org, currency, input.contractNumber, "СПокупателем"),
    oneCGet<{ value: { Ref_Key: string; Code: string }[] }>(`/${q("ChartOfAccounts_Хозрасчетный")}?$select=Ref_Key,Code`),
  ]);
  const advances = chart.value.find((a) => a.Code.trim() === "62.02")?.Ref_Key;

  const items: string[] = [];
  for (const l of input.lines) items.push(await itemRef(l.product, sample.Номенклатура_Key));
  const unit = await units(items);
  // Номенклатурная группа of each item -- the income's subconto.
  const groups = new Map<string, string>();
  for (const ref of new Set(items)) {
    const card = await oneCGet<{ НоменклатурнаяГруппа_Key?: string }>(`/${q("Catalog_Номенклатура")}(guid'${ref}')?$select=НоменклатурнаяГруппа_Key`);
    if (card.НоменклатурнаяГруппа_Key && card.НоменклатурнаяГруппа_Key !== EMPTY) groups.set(ref, card.НоменклатурнаяГруппа_Key);
  }

  const lineVat = input.lines.map((l) => (percent ? Math.round((l.price * l.quantity * percent) / (100 + percent)) : 0));
  const total = input.lines.reduce((s, l) => s + l.price * l.quantity, 0);
  const vatTotal = lineVat.reduce((s, v) => s + v, 0);
  const now = new Date();

  const sale = await createPosted(SALE, {
    ...header,
    Date: oneCDateTime(now),
    ВидОперации: "Товары",
    Контрагент_Key: input.buyer,
    ДоговорКонтрагента_Key: contract,
    ...(input.invoiceRef ? { СчетНаОплатуПокупателю_Key: input.invoiceRef } : {}),
    ...(advances ? { СпособЗачетаАвансов: "Автоматически", СчетУчетаРасчетовПоАвансам_Key: advances } : { СпособЗачетаАвансов: "НеЗачитывать" }),
    СуммаВключаетНДС: true,
    ЭтоУниверсальныйДокумент: true,
    СуммаДокумента: total / 100,
    Комментарий: input.comment,
    Товары: input.lines.map((l, i) => ({
      LineNumber: String(i + 1),
      Номенклатура_Key: items[i],
      ЕдиницаИзмерения_Key: unit.get(items[i]),
      Коэффициент: 1,
      Количество: l.quantity,
      Цена: l.price / 100,
      Сумма: (l.price * l.quantity) / 100,
      СтавкаНДС: rate,
      СуммаНДС: lineVat[i] / 100,
      ...Object.fromEntries(LINE_ACCOUNTS.filter((f) => sample[f]).map((f) => [f, sample[f]])),
      Субконто: groups.get(items[i]) ?? sample.Субконто,
      Субконто_Type: "StandardODATA.Catalog_НоменклатурныеГруппы",
    })),
  });

  // The Счет-фактура: made by 1С with the УПД, else written here.
  const existing = await oneCGet<{ value: { Ref_Key: string; ПредставлениеНомера?: string; Number: string }[] }>(
    `/${q(TAX_INVOICE)}?$filter=${q(`ДокументОснование eq cast(guid'${sale.ref}','${SALE}') and DeletionMark eq false`)}&$select=Ref_Key,Number,ПредставлениеНомера`
  ).catch(() => ({ value: [] }));
  let number = existing.value[0]?.ПредставлениеНомера || (existing.value[0] && shortNumber(existing.value[0].Number));
  if (!number) try {
    const day = oneCDateTime(new Date(now.toLocaleDateString("sv-SE", { timeZone: "Europe/Moscow" }) + "T00:00:00+03:00"));
    const taxInvoice = await createPosted(TAX_INVOICE, {
      Date: oneCDateTime(now),
      ВидСчетаФактуры: "НаРеализацию",
      Организация_Key: org,
      Контрагент_Key: input.buyer,
      ДоговорКонтрагента_Key: contract,
      ДокументОснование: sale.ref,
      ДокументОснование_Type: SALE_TYPE,
      КодВидаОперации: "01",
      Выставлен: true,
      ДатаВыставления: day,
      КодСпособаВыставления: 1,
      СуммаДокумента: total / 100,
      СуммаНДСДокумента: vatTotal / 100,
      ВалютаДокумента_Key: currency,
      ДокументыОснования: [{ LineNumber: "1", ДокументОснование: sale.ref, ДокументОснование_Type: SALE_TYPE }],
      ДокументыОбОтгрузке: [{ LineNumber: "1", НаименованиеДокумента: "Товарная накладная", НомерДокумента: shortNumber(sale.number), ДатаДокумента: day }],
    });
    const saved = await oneCGet<{ ПредставлениеНомера?: string; Number: string }>(`/${q(TAX_INVOICE)}(guid'${taxInvoice.ref}')?$select=Number,ПредставлениеНомера`);
    number = saved.ПредставлениеНомера || shortNumber(saved.Number);
  } catch (error) {
    // Without its Счет-фактура the УПД is not complete: the Реализация goes too.
    await oneCSend("POST", `/${q(SALE)}(guid'${sale.ref}')/Unpost`).catch(() => {});
    await oneCSend("PATCH", `/${q(SALE)}(guid'${sale.ref}')`, { DeletionMark: true }).catch(() => {});
    throw new OneCError(`Реализация № ${shortNumber(sale.number)} помечена на удаление — не записался счёт-фактура: ${error instanceof Error ? error.message : ""}`);
  }
  return { saleRef: sale.ref, saleNumber: shortNumber(sale.number), number, date: now, vatRate: percent, lineVat };
}
