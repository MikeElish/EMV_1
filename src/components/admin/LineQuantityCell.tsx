"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateLineQuantity } from "@/actions/admin/orders";

export function LineQuantityCell({ itemId, current }: { itemId: string; current: number }) {
  const router = useRouter();
  const [value, setValue] = useState(String(current));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const qty = parseInt(value.replace(/\D/g, ""), 10);
    if (!Number.isInteger(qty) || qty < 1) return setError("Количество");
    setSaving(true);
    const result = await updateLineQuantity(itemId, qty);
    setSaving(false);
    if (!result.ok) return setError(result.error);
    setError(null);
    router.refresh();
  }

  return (
    <div className="min-w-16">
      <div className="flex items-center gap-1">
        <input
          aria-label="Количество"
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && save()}
          className="w-16 rounded border border-foreground/20 bg-transparent px-1.5 py-0.5 text-sm outline-none focus:border-foreground/50"
        />
        <button
          type="button"
          onClick={save}
          disabled={saving || !value.trim() || Number(value) === current}
          className="rounded bg-foreground px-1.5 py-0.5 text-xs text-background disabled:opacity-40"
        >
          {saving ? "…" : "OK"}
        </button>
      </div>
      {error && <p className="mt-0.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}
