"use client";

import { useState, type FormEvent } from "react";
import type { ProductInput } from "@/lib/validators/product";
import type { ActionResult } from "@/actions/admin/products";
import type { Markups } from "@/lib/pricing";
import { ProductImagesField } from "@/components/admin/ProductImagesField";
import {
  ProductPricesPanel,
  SALE_KINDS,
  initialPrices,
  toKopecks,
  type OfferRow,
  type PricesState,
} from "@/components/admin/ProductPricesPanel";

type Category = { id: string; name: string };
type Supplier = { id: string; name: string; inn: string | null };
type Tab = "main" | "prices";

const TAB_LABELS: Record<Tab, string> = { main: "Основное", prices: "Цены" };

function splitList(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function ProductForm({
  categories,
  suppliers,
  markups,
  initial,
  initialPricing,
  offers = [],
  onSubmit,
}: {
  categories: Category[];
  suppliers: Supplier[];
  markups: Markups;
  initial?: Partial<ProductInput> & {
    compatibleWithText?: string;
    images?: string[];
  };
  initialPricing?: Parameters<typeof initialPrices>[1];
  /** Supplier offers of an existing card (view only, one is picked for the site). */
  offers?: OfferRow[];
  onSubmit: (input: ProductInput) => Promise<ActionResult>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [images, setImages] = useState<string[]>(initial?.images ?? []);
  const [tab, setTab] = useState<Tab>("main");
  const [prices, setPrices] = useState<PricesState>(() => initialPrices(markups, initialPricing, offers));

  function failOnPrices(message: string) {
    setError(message);
    setTab("prices");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    // An inactive product (e.g. imported from 1С, still being sorted out) can
    // be saved without prices; they are required once it goes on sale.
    const active = formData.get("isActive") === "on";

    const purchasePrice = toKopecks(prices.purchaseRub) ?? (active ? null : 0);
    if (purchasePrice === null || (active && purchasePrice <= 0)) return failOnPrices("Укажите закупочную цену");
    const sale = {} as Record<(typeof SALE_KINDS)[number]["kind"], number>;
    for (const { kind, label } of SALE_KINDS) {
      const value = toKopecks(prices.sale[kind].rub) ?? (active ? null : 0);
      if (value === null) return failOnPrices(`Укажите цену: ${label.toLowerCase()}`);
      sale[kind] = value;
    }

    setSubmitting(true);

    const input: ProductInput = {
      sku: String(formData.get("sku") ?? ""),
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? "") || undefined,
      price: sale.wholesale,
      purchasePrice,
      retailPrice: sale.retail,
      dealerPrice: sale.dealer,
      supplierId: prices.supplierId || undefined,
      deliveryDays: prices.deliveryDays ? Number(prices.deliveryDays) : undefined,
      quality: prices.quality.trim() || undefined,
      selectedOfferId: prices.selectedOfferId || undefined,
      stock: Number(formData.get("stock") ?? 0),
      categoryId: String(formData.get("categoryId") ?? ""),
      brand: String(formData.get("brand") ?? "") || undefined,
      machineType: String(formData.get("machineType") ?? "") || undefined,
      compatibleWith: splitList(String(formData.get("compatibleWith") ?? "")),
      images,
      isActive: active,
    };

    // on success, onSubmit redirects server-side and this call never resolves
    const result = await onSubmit(input);

    setSubmitting(false);
    if (!result.ok) {
      if (result.error.includes("«Цены»")) failOnPrices(result.error);
      else setError(result.error);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      // A required field on the hidden tab would otherwise block submit
      // silently -- jump to the tab that holds it.
      onInvalidCapture={(e) => {
        const panel = (e.target as HTMLElement).closest("[data-tab]");
        if (panel) setTab(panel.getAttribute("data-tab") as Tab);
      }}
      className="mt-6 max-w-xl"
    >
      <div className="flex gap-4 border-b border-foreground/10">
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-1 pb-2 text-sm font-medium transition-colors ${
              tab === t ? "border-foreground text-foreground" : "border-transparent text-foreground/50 hover:text-foreground"
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div data-tab="prices" className={tab === "prices" ? "mt-4" : "hidden"}>
        <ProductPricesPanel value={prices} onChange={setPrices} suppliers={suppliers} offers={offers} />
      </div>

      <div data-tab="main" className={tab === "main" ? "mt-4 space-y-4" : "hidden"}>
      <div>
        <label htmlFor="sku" className="text-sm text-foreground/60">
          Артикул (SKU)
        </label>
        <input
          id="sku"
          name="sku"
          required
          defaultValue={initial?.sku}
          className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
        />
      </div>

      <div>
        <label htmlFor="name" className="text-sm text-foreground/60">
          Название
        </label>
        <input
          id="name"
          name="name"
          required
          defaultValue={initial?.name}
          className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
        />
      </div>

      <div>
        <label htmlFor="description" className="text-sm text-foreground/60">
          Описание
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={initial?.description}
          className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="stock" className="text-sm text-foreground/60">
            Остаток
          </label>
          <input
            id="stock"
            name="stock"
            type="number"
            min={0}
            required
            defaultValue={initial?.stock ?? 0}
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
          />
        </div>
        <div>
          <label htmlFor="categoryId" className="text-sm text-foreground/60">
            Категория
          </label>
          <select
            id="categoryId"
            name="categoryId"
            required
            defaultValue={initial?.categoryId}
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
          >
            <option value="" disabled>
              Выберите
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="brand" className="text-sm text-foreground/60">
            Бренд
          </label>
          <input
            id="brand"
            name="brand"
            defaultValue={initial?.brand}
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
          />
        </div>
        <div>
          <label htmlFor="machineType" className="text-sm text-foreground/60">
            Тип техники
          </label>
          <input
            id="machineType"
            name="machineType"
            defaultValue={initial?.machineType}
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
          />
        </div>
      </div>

      <div>
        <label htmlFor="compatibleWith" className="text-sm text-foreground/60">
          Совместимо с (через запятую)
        </label>
        <input
          id="compatibleWith"
          name="compatibleWith"
          defaultValue={initial?.compatibleWithText}
          placeholder="CAT 320, Komatsu PC200"
          className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
        />
      </div>

      <ProductImagesField images={images} onChange={setImages} />

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={initial?.isActive ?? true}
        />
        Товар активен (виден в магазине)
      </label>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="mt-4 rounded-md bg-foreground px-6 py-2 font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Сохраняем..." : "Сохранить"}
      </button>
    </form>
  );
}
