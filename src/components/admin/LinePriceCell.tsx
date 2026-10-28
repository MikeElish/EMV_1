"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateLinePrice } from "@/actions/admin/orders";
import { rublesToKopecksRoundedUp } from "@/lib/money";

/**
 * A line ordered «По запросу»: the manager types its price here. With
 * `current` -- «Ручное редактирование» of the owner: the price as it is, to correct.
 */
export function LinePriceCell({ itemId, current }: { itemId: string; current?: number }) {
  const router = useRouter();
  const initial = current && current > 0 ? String(current / 100).replace(".", ",") : "";
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const rub = parseFloat(value.replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(rub) || rub <= 0) return setError("Укажите цену");
    setSaving(true);
    const result = await updateLinePrice(itemId, rublesToKopecksRoundedUp(rub));
    setSaving(false);
    if (!result.ok) return setError(result.error);
    setError(null);
    router.refresh();
  }

  return (
    <div className="min-w-32">
      {current === undefined && <span className="text-xs text-amber-600 dark:text-amber-500">По запросу</span>}
      <div className="mt-0.5 flex items-center gap-1">
        <input
          aria-label="Цена, ₽"
          inputMode="decimal"
          placeholder="Цена, ₽"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          className="w-24 rounded border border-foreground/20 bg-transparent px-1.5 py-0.5 text-sm outline-none focus:border-foreground/50"
        />
        <button
          type="button"
          onClick={save}
          disabled={saving || !value.trim() || value === initial}
          className="rounded bg-foreground px-1.5 py-0.5 text-xs text-background disabled:opacity-40"
        >
          {saving ? "…" : "OK"}
        </button>
      </div>
      {error && <p className="mt-0.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}
