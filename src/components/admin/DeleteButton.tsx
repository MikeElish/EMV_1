"use client";

import { useState, useTransition } from "react";

export function DeleteButton({
  action,
  confirmText = "Удалить?",
  className,
}: {
  action: () => Promise<{ ok: boolean; error?: string }>;
  confirmText?: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (!confirm(confirmText)) return;
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? "Не удалось удалить");
    });
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className={className ?? "text-red-600 hover:underline disabled:opacity-50"}
      >
        {pending ? "..." : "Удалить"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
