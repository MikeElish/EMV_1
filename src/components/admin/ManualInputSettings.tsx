"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setManualInputEnabled } from "@/actions/admin/site-settings";

export function ManualInputSettings({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [checked, setChecked] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function change(next: boolean) {
    const previous = checked;
    setChecked(next);
    setError(null);
    startTransition(async () => {
      const result = await setManualInputEnabled(next);
      if (!result.ok) {
        setChecked(previous);
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <label className="flex cursor-pointer items-center justify-between gap-4">
        <span>
          <span className="block font-medium">Ручной ввод</span>
          <span className="mt-1 block text-sm text-foreground/60">
            Включает ручные поля и добавление позиций в заказах и заказах поставщику.
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={pending}
          onClick={() => change(!checked)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${checked ? "bg-green-600" : "bg-foreground/20"}`}
        >
          <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? "left-6" : "left-1"}`} />
        </button>
      </label>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
