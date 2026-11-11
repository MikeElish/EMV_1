"use client";

import { useEffect, useState } from "react";
import { getOrCreateProfile, saveSupplierLogisticsMarkup, saveSupplierProfile } from "@/actions/admin/supplier-profiles";

export function SupplierProfileTab({
  companyId,
  companyName,
  canEditMarkup,
}: {
  companyId: string;
  companyName: string;
  canEditMarkup: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [brands, setBrands] = useState("");
  const [categories, setCategories] = useState("");
  const [markup, setMarkup] = useState("0");
  const [savingMarkup, setSavingMarkup] = useState(false);
  const [markupSaved, setMarkupSaved] = useState(false);
  const [markupError, setMarkupError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getOrCreateProfile(companyId)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setBrands(result.profile.brands);
          setCategories(result.profile.categories);
          setMarkup(String(result.profile.logisticsMarkupPercent));
          setLoaded(true);
        } else {
          setError(result.error);
        }
      })
      .catch((cause: unknown) => {
        console.error("[supplier-profiles] load", cause);
        if (!cancelled) setError("Не удалось загрузить профиль поставщика");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [companyId]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const result = await saveSupplierProfile(companyId, brands, categories);
      if (!result.ok) {
        setError(result.error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (cause) {
      console.error("[supplier-profiles] save", cause);
      setError("Не удалось сохранить профиль поставщика");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveMarkup() {
    setSavingMarkup(true);
    setMarkupSaved(false);
    setMarkupError(null);
    const value = Number(markup.replace(",", "."));
    try {
      const result = await saveSupplierLogisticsMarkup(companyId, value);
      if (!result.ok) setMarkupError(result.error);
      else {
        setMarkupSaved(true);
        setTimeout(() => setMarkupSaved(false), 3000);
      }
    } catch (cause) {
      console.error("[supplier-profiles] save logistics markup", cause);
      setMarkupError("Не удалось сохранить логистическую надбавку");
    } finally {
      setSavingMarkup(false);
    }
  }

  if (loading) {
    return (
      <div className="mt-4 text-sm text-foreground/50">Загрузка профиля…</div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          Профиль: {companyName}
        </h3>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !loaded}
          className="rounded-md bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Сохраняем…" : "Сохранить"}
        </button>
      </div>

      <div>
        <label htmlFor="sp-brands" className="text-sm text-foreground/60">
          Бренды
        </label>
        <p className="mt-0.5 text-xs text-foreground/40">
          Справочная информация; запросы КП направляются только по сохранённым предложениям поставщика.
        </p>
        <textarea
          id="sp-brands"
          rows={3}
          value={brands}
          onChange={(e) => setBrands(e.target.value)}
          placeholder="CAT, Komatsu, Volvo, JCB…"
          className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
        />
      </div>

      <div>
        <label htmlFor="sp-categories" className="text-sm text-foreground/60">
          Категории товаров
        </label>
        <p className="mt-0.5 text-xs text-foreground/40">
          Категории номенклатуры, с которыми работает поставщик; автозаполнение отключено.
        </p>
        <textarea
          id="sp-categories"
          rows={3}
          value={categories}
          onChange={(e) => setCategories(e.target.value)}
          placeholder="Гусеницы, ковши, фильтры, гидравлика…"
          className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
        />
      </div>

      <div className="border-t border-foreground/10 pt-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <label htmlFor="sp-logistics-markup" className="text-sm text-foreground/60">
              Логистическая надбавка, %
            </label>
            <input
              id="sp-logistics-markup"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={markup}
              onChange={(event) => setMarkup(event.target.value)}
              disabled={!canEditMarkup}
              className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50 disabled:opacity-60"
            />
          </div>
          {canEditMarkup && (
            <button
              type="button"
              onClick={handleSaveMarkup}
              disabled={savingMarkup || !loaded}
              className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium hover:bg-foreground/5 disabled:opacity-50"
            >
              {savingMarkup ? "Сохраняем…" : "Сохранить процент"}
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-foreground/40">Добавляется к закупочной стоимости в «Заказе поставщику»; цену клиента не меняет. Устанавливает владелец.</p>
        {markupError && <p className="mt-1 text-sm text-red-600">{markupError}</p>}
        {markupSaved && <p className="mt-1 text-sm text-green-600">Процент сохранён.</p>}
      </div>

      {saved && (
        <p className="text-sm text-green-600">Профиль сохранён.</p>
      )}
    </div>
  );
}
