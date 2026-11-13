"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Markups } from "@/lib/pricing";
import type { ExchangeRates } from "@/lib/supplier-currency";
import type { CbrRates } from "@/lib/cbr-exchange-rates";
import { savePriceSettings, recalculateAllPrices, type ActionResult } from "@/actions/admin/price-settings";

const MARKUP_FIELDS: { key: keyof Markups; label: string; hint?: string }[] = [
  { key: "retailMarkup", label: "Розничная цена" },
  { key: "wholesaleMarkup", label: "Оптовая цена", hint: "показывается на сайте" },
  { key: "dealerMarkup", label: "Дилерская цена" },
];

const RATE_FIELDS: { key: keyof ExchangeRates; label: string; cbr: keyof CbrRates }[] = [
  { key: "USD", label: "Доллар США", cbr: "USD" },
  { key: "EUR", label: "Евро", cbr: "EUR" },
  { key: "CNY", label: "Юань", cbr: "CNY" },
];

const inputClassName =
  "w-28 rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50";

function ResultLine({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return result.ok ? (
    <p className="text-sm text-green-600">{result.message}</p>
  ) : (
    <p className="text-sm text-red-600">{result.error}</p>
  );
}

function formatRate(value: number | null): string {
  if (value === null) return "—";
  return value.toLocaleString("ru-RU", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

export function PriceSettingsForm({ markups, cbrRates }: { markups: Markups; cbrRates: CbrRates }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const readNum = (key: string) => Number(String(form.get(key) ?? "").replace(",", "."));
    setResult(
      await savePriceSettings({
        markups: {
          retailMarkup: readNum("retailMarkup"),
          wholesaleMarkup: readNum("wholesaleMarkup"),
          dealerMarkup: readNum("dealerMarkup"),
        },
        exchangeRates: {
          USD: readNum("exchangeRateUSD"),
          EUR: readNum("exchangeRateEUR"),
          CNY: readNum("exchangeRateCNY"),
        },
      })
    );
    setSaving(false);
    router.refresh();
  }

  async function handleRecalculate() {
    if (
      !confirm(
        "Пересчитать розничную, оптовую и дилерскую цены у ВСЕХ товаров от закупочной цены по сохранённым наценкам? Цены, исправленные вручную, будут перезаписаны."
      )
    )
      return;
    setResult(null);
    setRecalculating(true);
    setResult(await recalculateAllPrices());
    setRecalculating(false);
  }

  return (
    <div>
      <h1 className="text-lg font-semibold">Цены</h1>
      <p className="mt-1 max-w-xl text-sm text-foreground/60">
        Базовые наценки на закупочную цену и пользовательские курсы валют для проценки.
        Применяются автоматически при создании товара и при загрузке из файла; у уже существующих
        товаров цены меняются только кнопкой «Пересчитать все цены».
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        {MARKUP_FIELDS.map(({ key, label, hint }) => (
          <div key={key} className="flex items-center gap-4">
            <label htmlFor={key} className="w-44 text-sm">
              {label}
              {hint && <div className="text-xs text-foreground/40">{hint}</div>}
            </label>
            <input
              id={key}
              name={key}
              inputMode="decimal"
              required
              defaultValue={markups[key]}
              className={inputClassName}
            />
            <span className="text-sm text-foreground/50">%</span>
          </div>
        ))}

        <div className="pt-4">
          <h2 className="text-sm font-medium">Курсы валют ЦБ РФ (покупка) на текущую дату</h2>
          <p className="text-xs text-foreground/50">
            Указанные курсы используются в проценке при сохранении предложений поставщиков в валюте.
          </p>
        </div>
        {RATE_FIELDS.map(({ key, label, cbr }) => (
          <div key={key} className="flex items-center gap-4">
            <label htmlFor={`exchangeRate${key}`} className="w-44 text-sm">
              {label}
            </label>
            <input
              id={`exchangeRate${key}`}
              name={`exchangeRate${key}`}
              inputMode="decimal"
              required
              defaultValue={cbrRates[cbr] ?? 0}
              className={inputClassName}
            />
            <span className="text-sm text-foreground/50">₽</span>
            <span className="text-xs text-foreground/40">ЦБ РФ: {formatRate(cbrRates[cbr])} ₽</span>
          </div>
        ))}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-foreground px-6 py-2 font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Сохраняем..." : "Сохранить"}
          </button>
          <button
            type="button"
            onClick={handleRecalculate}
            disabled={recalculating}
            className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {recalculating ? "Пересчитываем..." : "Пересчитать все цены"}
          </button>
        </div>
        <ResultLine result={result} />
      </form>
    </div>
  );
}
