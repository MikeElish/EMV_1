import { z } from "zod";

/**
 * "https://msk1.1cfresh.com/a/ba/3459405/ru/" (what the browser shows) ->
 * "https://msk1.1cfresh.com/a/ba/3459405": the language suffix and any
 * OData path are dropped, the API path is added when calling.
 */
export function normalizeOneCUrl(value: string) {
  return value
    .trim()
    .replace(/\/odata\/.*$/i, "")
    .replace(/\/(ru|en)\/?$/i, "")
    .replace(/\/+$/, "");
}

export const oneCSettingsSchema = z.object({
  baseUrl: z
    .string()
    .transform(normalizeOneCUrl)
    .refine((v) => /^https:\/\/[^\s/]+\/\S+$/i.test(v), "Укажите адрес базы, например https://msk1.1cfresh.com/a/ba/3459405/ru/"),
  login: z.string().trim().min(1, "Укажите логин"),
  // Empty means "keep the stored password".
  password: z.string().optional(),
});
export type OneCSettingsInput = z.input<typeof oneCSettingsSchema>;

/** What the site needs from 1С:Бухгалтерия, as OData entity set names. */
export const ONEC_REQUIRED_OBJECTS: { name: string; label: string }[] = [
  { name: "Catalog_Организации", label: "Справочник «Организации»" },
  { name: "Catalog_Номенклатура", label: "Справочник «Номенклатура»" },
  { name: "Catalog_КлассификаторЕдиницИзмерения", label: "Справочник «Единицы измерения»" },
  { name: "Catalog_Контрагенты", label: "Справочник «Контрагенты»" },
  { name: "Catalog_ДоговорыКонтрагентов", label: "Справочник «Договоры»" },
  { name: "Catalog_Склады", label: "Справочник «Склады»" },
  { name: "Catalog_ВидыНоменклатуры", label: "Справочник «Виды номенклатуры»" },
  { name: "Catalog_НоменклатурныеГруппы", label: "Справочник «Номенклатурные группы»" },
  { name: "Catalog_ТипыЦенНоменклатуры", label: "Справочник «Типы цен номенклатуры»" },
  { name: "Catalog_БанковскиеСчета", label: "Справочник «Банковские счета»" },
  { name: "Catalog_Валюты", label: "Справочник «Валюты»" },
  { name: "Catalog_Патенты", label: "Справочник «Патенты»" },
  { name: "ChartOfAccounts_Хозрасчетный", label: "План счетов «Хозрасчётный»" },
  { name: "InformationRegister_ЦеныНоменклатуры", label: "Регистр сведений «Цены номенклатуры»" },
  { name: "Document_СчетНаОплатуПокупателю", label: "Документ «Счёт покупателю»" },
  { name: "Document_РеализацияТоваровУслуг", label: "Документ «Реализация (акт, накладная, УПД)»" },
  { name: "Document_ПоступлениеТоваровУслуг", label: "Документ «Поступление (акт, накладная, УПД)»" },
  { name: "Document_СчетФактураВыданный", label: "Документ «Счёт-фактура выданный»" },
  { name: "Document_ПоступлениеНаРасчетныйСчет", label: "Документ «Поступление на расчётный счёт»" },
];
