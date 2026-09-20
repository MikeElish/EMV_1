"use client";

import { useState, type FormEvent } from "react";
import type { ProductInput } from "@/lib/validators/product";
import type { ActionResult } from "@/actions/admin/products";
import { rublesToKopecksRoundedUp } from "@/lib/money";
import { ProductImagesField } from "@/components/admin/ProductImagesField";

type Category = { id: string; name: string };

function splitList(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function ProductForm({
  categories,
  initial,
  onSubmit,
}: {
  categories: Category[];
  initial?: Partial<ProductInput> & {
    priceRub?: string;
    compatibleWithText?: string;
    images?: string[];
  };
  onSubmit: (input: ProductInput) => Promise<ActionResult>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [images, setImages] = useState<string[]>(initial?.images ?? []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const priceRub = String(formData.get("priceRub") ?? "0").replace(",", ".");
    const price = rublesToKopecksRoundedUp(parseFloat(priceRub || "0"));

    const input: ProductInput = {
      sku: String(formData.get("sku") ?? ""),
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? "") || undefined,
      price: Number.isFinite(price) ? price : 0,
      stock: Number(formData.get("stock") ?? 0),
      categoryId: String(formData.get("categoryId") ?? ""),
      brand: String(formData.get("brand") ?? "") || undefined,
      machineType: String(formData.get("machineType") ?? "") || undefined,
      compatibleWith: splitList(String(formData.get("compatibleWith") ?? "")),
      images,
      isActive: formData.get("isActive") === "on",
    };

    // on success, onSubmit redirects server-side and this call never resolves
    const result = await onSubmit(input);

    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 max-w-xl space-y-4">
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

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label htmlFor="priceRub" className="text-sm text-foreground/60">
            Цена, ₽
          </label>
          <input
            id="priceRub"
            name="priceRub"
            required
            inputMode="decimal"
            defaultValue={initial?.priceRub}
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
          />
        </div>
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

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-foreground px-6 py-2 font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Сохраняем..." : "Сохранить"}
      </button>
    </form>
  );
}
