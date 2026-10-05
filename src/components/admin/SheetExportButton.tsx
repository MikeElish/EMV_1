"use client";

import { useState, useTransition } from "react";
import type { SheetResult } from "@/actions/admin/supplier-orders";
import { downloadBase64, XLSX_TYPE } from "@/lib/download";

/** «Выгрузка»: the rows on screen go to an Excel file. */
export function SheetExportButton({ count, run }: { count: number; run: () => Promise<SheetResult> }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function click() {
    setError(null);
    startTransition(async () => {
      const result = await run();
      if (!result.ok) setError(result.error);
      else downloadBase64(result.base64, result.fileName, XLSX_TYPE);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={click}
        disabled={pending || count === 0}
        title={count ? `Выгрузить в Excel: ${count} поз.` : "Нет позиций для выгрузки"}
        className="shrink-0 rounded-md border border-foreground/20 px-3 py-1 text-sm font-medium transition-colors hover:bg-foreground/5 disabled:opacity-40"
      >
        {pending ? "Выгружаем..." : "Выгрузка"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </>
  );
}
