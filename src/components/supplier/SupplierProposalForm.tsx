"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { importSupplierProposal, importSupplierProposalPreview, submitSupplierProposal } from "@/actions/supplier-proposal";
import { RU_CITIES } from "@/content/ru-cities";
import { QUALITY_SUGGESTIONS } from "@/components/admin/ProductPricesPanel";
import type { SupplierQuoteRow } from "@/lib/supplier-quote";
import { SUPPLIER_CURRENCIES, SUPPLIER_CURRENCY_SYMBOLS, type SupplierCurrency } from "@/lib/supplier-currency";

type Entry = { productId: string; priceRub: string; currency: SupplierCurrency; noOffer: boolean; inStock: boolean; stockQuantity: string; quality: string; warehouse: string; deliveryDays: string };
type Result = { ok: true; entries: Entry[] } | { ok: false; error: string };
type Language = "ru" | "en" | "zh";

const TEXT: Record<Language, Record<string, string>> = {
  ru: {
    request: "Запрос коммерческого предложения", supplier: "Поставщик", export: "Выгрузить Excel",
    import: "Загрузить Excel", hint: "Заполните поля здесь или внесите данные в Excel и загрузите файл.",
    test: "Тестовый просмотр — данные заказа настоящие, но отправка предложения и уведомление менеджера отключены.",
    currencyRUB: "Рубли", currencyUSD: "Доллар США", currencyEUR: "Евро", currencyCNY: "Юань",
    number: "№", brand: "Бренд", name: "Наименование", sku: "Артикул", quantity: "Количество", price: "Цена", currency: "Валюта",
    total: "Всего", noOffer: "Нет предложения", inStock: "Наличие", stockQuantity: "Кол-во в наличии", quality: "Качество", warehouse: "Склад",
    delivery: "Срок поставки (дней)", noOfferHint: "Если по позиции нет предложения, оставьте поле «Цена» пустым — для неё будет отмечено «Нет предложения».",
    send: "Направить предложение", sending: "Отправляем...", thanks: "Спасибо за ответ!",
    testSaved: "Это тестовый просмотр: предложение не сохранено и менеджеру не отправлено.",
    chooseFile: "Выберите Excel-файл", submitError: "Проверьте заполненные поля", download: "Выгрузить Excel",
  },
  en: {
    request: "Request for quotation", supplier: "Supplier", export: "Download Excel",
    import: "Upload Excel", hint: "Fill in the fields here or enter the data in Excel and upload the file.",
    test: "Preview only — order data is real, but submitting the quote and notifying the manager are disabled.",
    currencyRUB: "Russian ruble", currencyUSD: "US dollar", currencyEUR: "Euro", currencyCNY: "Chinese yuan",
    number: "No.", brand: "Brand", name: "Item name", sku: "Part number", quantity: "Quantity", price: "Price", currency: "Currency",
    total: "Total", noOffer: "No offer", inStock: "In stock", stockQuantity: "Stock qty", quality: "Quality", warehouse: "Warehouse",
    delivery: "Delivery time (days)", noOfferHint: "If you cannot offer an item, leave its price blank and select “No offer”.",
    send: "Submit quotation", sending: "Submitting...", thanks: "Thank you for your response!",
    testSaved: "Preview only: the quotation was not saved or sent to the manager.",
    chooseFile: "Select an Excel file", submitError: "Check the entered values", download: "Download Excel",
  },
  zh: {
    request: "报价请求", supplier: "供应商", export: "下载 Excel",
    import: "上传 Excel", hint: "请在此填写，或在 Excel 中填写后上传。",
    test: "预览模式：订单数据真实，但提交报价和通知经理功能已禁用。",
    currencyRUB: "俄罗斯卢布", currencyUSD: "美元", currencyEUR: "欧元", currencyCNY: "人民币",
    number: "序号", brand: "品牌", name: "商品名称", sku: "零件号", quantity: "数量", price: "价格", currency: "货币",
    total: "总计", noOffer: "无报价", inStock: "有现货", stockQuantity: "现货数量", quality: "质量", warehouse: "仓库",
    delivery: "交货时间（天）", noOfferHint: "无法报价时，请将价格留空并勾选“无报价”。",
    send: "提交报价", sending: "正在提交...", thanks: "感谢您的回复！",
    testSaved: "预览模式：报价未保存，也未发送给经理。",
    chooseFile: "请选择 Excel 文件", submitError: "请检查填写内容", download: "下载 Excel",
  },
};

function localizedError(error: string, language: Language) {
  if (language === "ru") return error;
  const known: Record<string, string> = {
    "Выберите Excel-файл": TEXT[language].chooseFile,
    "Проверьте заполненные поля": TEXT[language].submitError,
    "Ссылка на запрос больше не активна": language === "en" ? "This quotation link is no longer active." : "此报价链接已失效。",
  };
  return known[error] ?? error;
}

function priceRub(value: number | null): string {
  return value === null ? "" : (value / 100).toFixed(2).replace(".", ",");
}

function numericValue(value: string) {
  const parsed = Number(value.trim().replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function initialEntries(rows: SupplierQuoteRow[]): Entry[] {
  return rows.map((row) => ({
    productId: row.productId,
    priceRub: row.noOffer ? "" : priceRub(row.price),
    currency: row.currency,
    noOffer: row.noOffer,
    inStock: row.inStock,
    stockQuantity: row.stockQuantity === null ? "" : String(row.stockQuantity),
    quality: row.quality,
    warehouse: row.warehouse,
    deliveryDays: row.deliveryDays,
  }));
}

export function SupplierProposalForm({
  rows,
  token,
  previewOrderNumber,
  templateUrl,
  orderNumber,
  supplierName,
}: {
  rows: SupplierQuoteRow[];
  token?: string;
  previewOrderNumber?: string;
  templateUrl: string;
  orderNumber?: string;
  supplierName?: string;
}) {
  const [entries, setEntries] = useState(() => initialEntries(rows));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [language, setLanguage] = useState<Language>("ru");
  const t = TEXT[language];
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const saved = window.localStorage.getItem("supplier-proposal-language");
      if (saved === "ru" || saved === "en" || saved === "zh") setLanguage(saved);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function changeLanguage(value: string) {
    if (value !== "ru" && value !== "en" && value !== "zh") return;
    setLanguage(value);
    window.localStorage.setItem("supplier-proposal-language", value);
  }

  function update<K extends keyof Omit<Entry, "productId">>(productId: string, field: K, value: Entry[K]) {
    setEntries((current) => current.map((entry) => entry.productId === productId ? { ...entry, [field]: value } : entry));
  }

  const currencySymbol = (currency: SupplierCurrency) =>
    SUPPLIER_CURRENCY_SYMBOLS[currency];
  const formatMoney = (minor: number, currency: SupplierCurrency) =>
    new Intl.NumberFormat(language === "en" ? "en-US" : language === "zh" ? "zh-CN" : "ru-RU", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(minor / 100);

  function importFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = new FormData(event.currentTarget).get("file");
    if (!(file instanceof File)) {
      setError(t.chooseFile);
      return;
    }
    const formData = new FormData();
    formData.set("file", file);
    setError(null);
    startTransition(async () => {
      const result: Result = token
        ? await importSupplierProposal(token, formData)
        : await importSupplierProposalPreview(previewOrderNumber ?? "", formData);
      if (!result.ok) {
        setError(localizedError(result.error, language));
        return;
      }
      setEntries((current) => current.map((entry) => result.entries.find((row) => row.productId === entry.productId) ?? entry));
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!token) {
      setSubmitted(true);
      return;
    }
    startTransition(async () => {
      const result = await submitSupplierProposal(token, entries);
      if (!result.ok) {
        setError(localizedError(result.error, language));
        return;
      }
      setNotificationError(result.notificationError ?? null);
      setSubmitted(true);
    });
  }

  if (submitted) {
    return (
      <div className="rounded-lg border border-foreground/10 bg-foreground/[0.03] p-8 text-center">
        <h2 className="text-xl font-semibold">{t.thanks}</h2>
        {!token && <p className="mt-2 text-sm text-foreground/60">{t.testSaved}</p>}
        {notificationError && <p className="mt-3 text-sm text-amber-700">{notificationError}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <label className="sr-only" htmlFor="supplier-proposal-language">Language</label>
        <select
          id="supplier-proposal-language"
          value={language}
          onChange={(event) => changeLanguage(event.target.value)}
          className="rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm"
        >
          <option value="en">English</option>
          <option value="ru">Русский</option>
          <option value="zh">中文</option>
        </select>
      </div>
      {(orderNumber || supplierName) && (
        <header className="mb-2">
          <p className="text-sm font-medium text-foreground/50">{t.request}</p>
          {orderNumber && <h1 className="mt-1 text-2xl font-semibold">#{orderNumber}</h1>}
          {supplierName && <p className="mt-2 text-sm text-foreground/60">{t.supplier}: {supplierName}</p>}
        </header>
      )}
      {!token && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-800">
          {t.test}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={templateUrl}
          className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium hover:bg-foreground/5"
        >
          {t.export}
        </a>
        <form onSubmit={importFile} className="flex flex-wrap items-center gap-2">
          <label className="cursor-pointer rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium hover:bg-foreground/5">
            {t.import}
            <input name="file" type="file" accept=".xlsx" className="sr-only" onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const form = event.currentTarget.form;
              if (form) void form.requestSubmit();
            }} />
          </label>
        </form>
        <span className="text-xs text-foreground/50">{t.hint}</span>
      </div>

      <form onSubmit={submit}>
        <div className="overflow-x-auto rounded-lg border border-foreground/10">
          <table className="w-full min-w-[1050px] text-sm">
            <thead className="bg-foreground/[0.03] text-left text-foreground/60">
              <tr>
                {[t.number, t.brand, t.name, t.sku, t.quantity, t.price, t.currency, t.total, t.noOffer, t.inStock, t.stockQuantity, t.quality, t.warehouse, t.delivery].map((heading) => (
                  <th key={heading} className="px-3 py-3 font-medium">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const entry = entries[index];
                const unitPrice = numericValue(entry.priceRub);
                return (
                  <tr key={row.productId} className="border-t border-foreground/10 align-top">
                    <td className="px-3 py-3">{index + 1}</td>
                    <td className="max-w-40 px-3 py-3">{row.brand ?? "—"}</td>
                    <td className="max-w-64 px-3 py-3">{row.name}</td>
                    <td className="whitespace-nowrap px-3 py-3">{row.sku}</td>
                    <td className="px-3 py-3">{row.quantity}</td>
                    <td className="min-w-32 px-3 py-2">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        inputMode="decimal"
                        aria-label={`${t.price}, ${row.sku}`}
                        disabled={entry.noOffer}
                        value={entry.priceRub}
                        onChange={(event) => update(row.productId, "priceRub", event.target.value)}
                        className="w-full rounded-md border border-foreground/20 bg-transparent px-2 py-1.5 outline-none focus:border-foreground/50"
                      />
                    </td>
                    <td className="min-w-36 px-3 py-2">
                      <select
                        aria-label={`${t.currency}, ${row.sku}`}
                        disabled={entry.noOffer}
                        value={entry.currency}
                        onChange={(event) => update(row.productId, "currency", event.target.value as SupplierCurrency)}
                        className="w-full rounded-md border border-foreground/20 bg-transparent px-2 py-1.5 outline-none focus:border-foreground/50"
                      >
                        {SUPPLIER_CURRENCIES.map((currency) => <option key={currency} value={currency}>{currencySymbol(currency)}</option>)}
                      </select>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">{unitPrice ? formatMoney(Math.round(unitPrice * row.quantity * 100), entry.currency) : "—"}</td>
                    <td className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={entry.noOffer}
                        onChange={(event) => update(row.productId, "noOffer", event.target.checked)}
                        aria-label={`${t.noOffer}, ${row.sku}`}
                      />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={entry.inStock}
                        disabled={entry.noOffer}
                        onChange={(event) => update(row.productId, "inStock", event.target.checked)}
                        aria-label={`${t.inStock}, ${row.sku}`}
                      />
                    </td>
                    <td className="min-w-28 px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        aria-label={`${t.stockQuantity}, ${row.sku}`}
                        disabled={entry.noOffer || !entry.inStock}
                        value={entry.stockQuantity}
                        onChange={(event) => update(row.productId, "stockQuantity", event.target.value)}
                        className="w-full rounded-md border border-foreground/20 bg-transparent px-2 py-1.5 outline-none focus:border-foreground/50"
                      />
                    </td>
                    <td className="min-w-40 px-3 py-2">
                      <select
                        aria-label={`${t.quality}, ${row.sku}`}
                        value={entry.quality}
                        disabled={entry.noOffer}
                        onChange={(event) => update(row.productId, "quality", event.target.value)}
                        className="w-full rounded-md border border-foreground/20 bg-transparent px-2 py-1.5 outline-none focus:border-foreground/50"
                      >
                        <option value="">—</option>
                        {QUALITY_SUGGESTIONS.map((quality) => <option key={quality} value={quality}>{quality}</option>)}
                      </select>
                    </td>
                    <td className="min-w-52 px-3 py-2">
                      <input
                        list="supplier-quote-cities"
                        aria-label={`Склад, ${row.sku}`}
                        value={entry.warehouse}
                        onChange={(event) => update(row.productId, "warehouse", event.target.value)}
                        className="w-full rounded-md border border-foreground/20 bg-transparent px-2 py-1.5 outline-none focus:border-foreground/50"
                      />
                    </td>
                    <td className="min-w-40 px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        max="365"
                        step="1"
                        inputMode="numeric"
                        aria-label={`${t.delivery}, ${row.sku}`}
                        value={entry.deliveryDays}
                        onChange={(event) => update(row.productId, "deliveryDays", event.target.value)}
                        className="w-full rounded-md border border-foreground/20 bg-transparent px-2 py-1.5 outline-none focus:border-foreground/50"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-foreground/50">
          {t.noOfferHint}
        </p>
        <datalist id="supplier-quote-cities">
          {RU_CITIES.map((city) => <option key={city} value={city} />)}
        </datalist>
        {error && <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>}
        <div className="mt-5 flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? t.sending : t.send}
          </button>
        </div>
      </form>
    </div>
  );
}
