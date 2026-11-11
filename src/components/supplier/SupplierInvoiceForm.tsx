"use client";

import { useState, useTransition, type FormEvent } from "react";
import { submitSupplierInvoice } from "@/actions/supplier-invoice";

export function SupplierInvoiceForm({ token }: { token: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await submitSupplierInvoice(token, form);
      if (!result.ok) setError(result.error);
      else setSubmitted(true);
    });
  }

  if (submitted) {
    return <p className="mt-2 rounded-md border border-green-600/20 bg-green-600/5 p-4 text-sm text-green-700">Счёт загружен. Благодарим!</p>;
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-3">
      <p className="text-sm text-foreground/60">Загрузите счёт в PDF, Excel, Word или в виде изображения. Максимальный размер файла — 20 МБ.</p>
      <input name="file" type="file" required accept=".pdf,.xlsx,.xls,.ods,.jpg,.jpeg,.png,.doc,.docx" className="block w-full text-sm" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={pending} className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50">
        {pending ? "Загружаем..." : "Загрузить счёт"}
      </button>
    </form>
  );
}
