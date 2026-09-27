"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Markups } from "@/lib/pricing";
import { savePriceSettings, recalculateAllPrices, type ActionResult } from "@/actions/admin/price-settings";

const FIELDS: { key: keyof Markups; label: string; hint?: string }[] = [
  { key: "retailMarkup", label: "Розничная цена" },
  { key: "wholesaleMarkup", label: "Оптовая цена", hint: "показывается на сайте" },
  { key: "dealerMarkup", label: "Дилерская цена" },
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

export function PriceSettingsForm({ markups }: { markups: Markups }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const read = (key: keyof Markups) => Number(String(form.get(key) ?? "").replace(",", "."));
    setResult(
      await savePriceSettings({
        retailMarkup: read("retailMarkup"),
        wholesaleMarkup: read("wholesaleMarkup"),
        dealerMarkup: read("dealerMarkup"),
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
        Базовые наценки на закупочную цену. Применяются автоматически при создании товара и при
        загрузке из файла; у уже существующих товаров цены меняются только кнопкой «Пересчитать все
        цены».
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        {FIELDS.map(({ key, label, hint }) => (
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
