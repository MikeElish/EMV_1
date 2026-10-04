"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setCategoryActive } from "@/actions/admin/categories";

/**
 * «Активна» of a category -- switches every product inside too, so it asks
 * first. `variant="checkbox"` for the category card, a pill for the table.
 */
export function CategoryActiveSwitch({
  categoryId,
  name,
  isActive,
  productCount,
  variant = "pill",
}: {
  categoryId: string;
  name: string;
  isActive: boolean;
  productCount: number;
  variant?: "pill" | "checkbox";
}) {
  const router = useRouter();
  const [value, setValue] = useState(isActive);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [synced, setSynced] = useState(isActive);
  if (isActive !== synced) {
    setSynced(isActive);
    setValue(isActive);
  }

  function toggle() {
    const next = !value;
    const what = next
      ? `Показать категорию «${name}» на сайте и сделать активными её товары (${productCount})?`
      : `Скрыть категорию «${name}» с сайта и сделать неактивными все её товары (${productCount})?`;
    if (!confirm(`${what}\nПодкатегории изменятся так же.`)) return;
    setMessage(null);
    setValue(next);
    startTransition(async () => {
      const result = await setCategoryActive(categoryId, next);
      if (!result.ok) {
        setValue(!next);
        setMessage(result.error);
        return;
      }
      if (result.skipped) {
        setMessage(`${result.skipped} товар(ов) без цены остались неактивными — укажите цены в карточках.`);
      }
      router.refresh();
    });
  }

  const note = message && <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-400">{message}</p>;

  if (variant === "checkbox") {
    return (
      <div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={value} disabled={pending} onChange={toggle} />
          Активна — показывать на сайте (вместе со всеми товарами категории)
        </label>
        {note}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        className={`rounded-full px-2 py-0.5 text-xs font-medium disabled:opacity-50 ${
          value ? "bg-green-600/10 text-green-700 dark:text-green-500" : "bg-foreground/10 text-foreground/50"
        }`}
      >
        {value ? "Да" : "Нет"}
      </button>
      {note}
    </>
  );
}
