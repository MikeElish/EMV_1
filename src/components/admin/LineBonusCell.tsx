"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateLineBonus } from "@/actions/admin/orders";
import { formatRub, rublesToKopecksRoundedUp } from "@/lib/money";

export function LineBonusCell({ itemId, bonus }: { itemId: string; bonus: number }) {
  const router = useRouter();
  const initial = String(bonus / 100).replace(".", ",");
  const [value, setValue] = useState(initial);
  const [synced, setSynced] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (initial !== synced) {
    setSynced(initial);
    setValue(initial);
  }

  async function save() {
    const rubles = parseFloat(value.replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(rubles) || rubles < 0) return setError("Укажите сумму от нуля");
    const next = rublesToKopecksRoundedUp(rubles);
    if (next === bonus) return;
    setPending(true);
    const result = await updateLineBonus(itemId, next);
    setPending(false);
    if (!result.ok) return setError(result.error);
    setError(null);
    router.refresh();
  }

  return (
    <div className="min-w-32">
      <div className="flex items-center gap-1">
        <input
          aria-label="Бонус за позицию, ₽"
          inputMode="decimal"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && void save()}
          className="w-24 rounded border border-foreground/20 bg-transparent px-1.5 py-0.5 text-sm outline-none focus:border-foreground/50"
        />
        <button
          type="button"
          onClick={() => void save()}
          disabled={pending || !value.trim() || rublesToKopecksRoundedUp(parseFloat(value.replace(",", "."))) === bonus}
          className="rounded bg-foreground px-1.5 py-0.5 text-xs text-background disabled:opacity-40"
        >
          {pending ? "…" : "OK"}
        </button>
      </div>
      <span className="block text-xs text-foreground/50">за строку: {formatRub(bonus)}</span>
      {error && <p className="mt-0.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}
