import "server-only";
import { OneCError, oneCGet } from "@/lib/onec";
import { oneCDateTime } from "@/lib/onec-stock";
import { contractRef, counterpartyRef, itemRef, vatPercent } from "@/lib/onec-invoice";
import { createPosted, units } from "@/lib/onec-stock-docs";

// «Поступление (акт, накладная, УПД)» in 1С:Бухгалтерия from Склад →
// Поступление: the supplier's УПД with its number and date, written and
// posted like the ones the accountant makes -- header from the latest posted
// one, the advance (the paid invoice) offset automatically on 60.02.

const q = encodeURIComponent;
const RECEIPT = "Document_ПоступлениеТоваровУслуг";

type TemplateLine = { Номенклатура_Key: string; СтавкаНДС: string; СчетУчета_Key: string; СчетУчетаНДС_Key: string };
type Template = Record<string, unknown> & { Товары: TemplateLine[] };

const HEADER_FIELDS = [
  "Организация_Key",
  "СчетУчетаРасчетовСКонтрагентом_Key",
  "СчетУчетаРасчетовСКомиссионером_Key",
  "ВалютаДокумента_Key",
  "Ответственный_Key",
  "КратностьВзаиморасчетов",
  "КурсВзаиморасчетов",
] as const;

async function template(): Promise<Template> {
  const filter = q("DeletionMark eq false and Posted eq true and ВидОперации eq 'Товары'");
  const r = await oneCGet<{ value: Template[] }>(`/${q(RECEIPT)}?$filter=${filter}&$orderby=${q("Date desc")}&$top=1`);
  const t = r.value[0];
  if (!t?.Товары?.length) throw new OneCError("В 1С нет ни одного проведённого поступления товаров, с которого взять настройки");
  return t;
}

/** The VAT rate of the supplier's latest Поступление in 1С (none yet: null). */
export async function supplierVatRate(supplierRef: string): Promise<string | null> {
  const filter = q(`Контрагент_Key eq guid'${supplierRef}' and DeletionMark eq false and Posted eq true`);
  const r = await oneCGet<{ value: { Товары?: { СтавкаНДС: string }[] }[] }>(`/${q(RECEIPT)}?$filter=${filter}&$orderby=${q("Date desc")}&$top=1&$select=Товары`);
  return r.value[0]?.Товары?.[0]?.СтавкаНДС ?? null;
}

export type ReceiptLine = { product: { id: string; sku: string; name: string }; quantity: number; /** kopecks */ price: number };

export async function createOneCReceipt(input: {
  supplier: { id: string; oneCRef: string | null; inn: string | null; name: string };
  warehouseRef: string;
  docNumber: string;
  docDate: Date;
  vatRate: string;
  lines: ReceiptLine[];
  comment: string;
}): Promise<{ ref: string; number: string }> {
  if (!input.lines.length) throw new OneCError("Нет строк для поступления");
  const t = await template();
  const supplier = await counterpartyRef(input.supplier);
  const org = String(t.Организация_Key);
  const [contract, chart] = await Promise.all([
    contractRef(supplier, org, String(t.ВалютаДокумента_Key), null, "СПоставщиком"),
    oneCGet<{ value: { Ref_Key: string; Code: string }[] }>(`/${q("ChartOfAccounts_Хозрасчетный")}?$select=Ref_Key,Code`),
  ]);
  const advances = chart.value.find((a) => a.Code.trim() === "60.02")?.Ref_Key;
  const sample = t.Товары[0];
  const percent = vatPercent(input.vatRate);

  const items: string[] = [];
  for (const l of input.lines) items.push(await itemRef(l.product, sample.Номенклатура_Key));
  const unit = await units(items);
  const header = Object.fromEntries(HEADER_FIELDS.filter((f) => t[f] !== undefined).map((f) => [f, t[f]]));
  const total = input.lines.reduce((s, l) => s + l.price * l.quantity, 0);

  return createPosted(RECEIPT, {
    ...header,
    Date: oneCDateTime(new Date()),
    ВидОперации: "Товары",
    Склад_Key: input.warehouseRef,
    Контрагент_Key: supplier,
    ДоговорКонтрагента_Key: contract,
    ...(advances ? { СпособЗачетаАвансов: "Автоматически", СчетУчетаРасчетовПоАвансам_Key: advances } : { СпособЗачетаАвансов: "НеЗачитывать" }),
    НомерВходящегоДокумента: input.docNumber,
    ДатаВходящегоДокумента: oneCDateTime(input.docDate),
    СуммаВключаетНДС: true,
    ЭтоУниверсальныйДокумент: true,
    СуммаДокумента: total / 100,
    Комментарий: input.comment,
    Товары: input.lines.map((l, i) => {
      const sum = l.price * l.quantity;
      return {
        LineNumber: String(i + 1),
        Номенклатура_Key: items[i],
        ЕдиницаИзмерения_Key: unit.get(items[i]),
        Коэффициент: 1,
        Количество: l.quantity,
        Цена: l.price / 100,
        Сумма: sum / 100,
        СтавкаНДС: input.vatRate,
        СуммаНДС: percent ? Math.round((sum * percent) / (100 + percent)) / 100 : 0,
        СчетУчета_Key: sample.СчетУчета_Key,
        СчетУчетаНДС_Key: sample.СчетУчетаНДС_Key,
        ОтражениеВУСН: "Принимаются",
        СпособУчетаНДС: "ПринимаетсяКВычету",
      };
    }),
  });
}
