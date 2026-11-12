"use client";

import { useState, useTransition, type FormEvent } from "react";
import { submitSupplierInvoice } from "@/actions/supplier-invoice";
import { formatSupplierCurrency, type SupplierCurrency } from "@/lib/supplier-currency";

export type InvoiceLine = {
  id: string;
  name: string;
  brand: string | null;
  sku: string;
  quantity: number;
  price: number;
  deliveryDays: number | null;
  quality: string | null;
  warehouse: string | null;
  source: string;
};

export function SupplierInvoiceForm({
  token,
  currency,
  total,
  lines,
}: {
  token: string;
  currency: SupplierCurrency;
  total: number;
  lines: InvoiceLine[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  function addFiles(event: FormEvent<HTMLInputElement>) {
    const selected = event.currentTarget.files;
    if (!selected) return;
    setFiles((current) => [...current, ...Array.from(selected)]);
    event.currentTarget.value = "";
  }

  function removeFile(index: number) {
    setFiles((current) => current.filter((_, i) => i !== index));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!files.length) {
      setError("Выберите хотя бы один документ");
      return;
    }
    const form = new FormData();
    for (const file of files) form.append("files", file);
    startTransition(async () => {
      const result = await submitSupplierInvoice(token, form);
      if (!result.ok) setError(result.error);
      else setSubmitted(true);
    });
  }

  if (submitted) {
    return (
      <div className="rounded-lg border border-green-600/20 bg-green-600/5 p-8 text-center">
        <h2 className="text-xl font-semibold">Документы отправлены</h2>
        <p className="mt-2 text-sm text-green-700">Спасибо! Мы проверим счёт и свяжемся при необходимости.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="space-y-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium hover:bg-foreground/5">
          <span>Вложить документы</span>
          <input
            name="files"
            type="file"
            multiple
            accept=".pdf,.xlsx,.xls,.ods,.jpg,.jpeg,.png,.doc,.docx"
            className="sr-only"
            onChange={addFiles}
          />
        </label>
        {files.length > 0 && (
          <ul className="space-y-1 text-sm">
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`} className="flex items-center gap-2">
                <span className="text-foreground/70">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Удалить
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-foreground/50">
          Допустимы PDF, Excel, Word или изображения. Максимальный размер одного файла — 20 МБ.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-foreground/10">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-foreground/[0.03] text-left text-foreground/60">
            <tr>
              <th className="px-3 py-2">№</th>
              <th className="px-3 py-2">Бренд</th>
              <th className="px-3 py-2">Наименование</th>
              <th className="px-3 py-2">Артикул</th>
              <th className="px-3 py-2">Назначение</th>
              <th className="px-3 py-2 text-right">Количество</th>
              <th className="px-3 py-2 text-right">Цена, {currency}</th>
              <th className="px-3 py-2 text-right">Стоимость, {currency}</th>
              <th className="px-3 py-2 text-right">Срок поставки</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={line.id} className="border-t border-foreground/10">
                <td className="px-3 py-2">{index + 1}</td>
                <td className="px-3 py-2">{line.brand ?? "—"}</td>
                <td className="px-3 py-2">{line.name}</td>
                <td className="px-3 py-2">{line.sku}</td>
                <td className="px-3 py-2">{line.source}</td>
                <td className="px-3 py-2 text-right">{line.quantity}</td>
                <td className="px-3 py-2 text-right">{formatSupplierCurrency(line.price, currency)}</td>
                <td className="px-3 py-2 text-right">{formatSupplierCurrency(line.price * line.quantity, currency)}</td>
                <td className="px-3 py-2 text-right">{line.deliveryDays == null ? "—" : `${line.deliveryDays} дн.`}</td>
              </tr>
            ))}
            <tr className="border-t border-foreground/10 font-semibold">
              <td colSpan={7} className="px-3 py-2 text-right">
                Итого
              </td>
              <td className="px-3 py-2 text-right">{formatSupplierCurrency(total, currency)}</td>
              <td className="px-3 py-2" />
            </tr>
          </tbody>
        </table>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending || !files.length}
          className="rounded-md bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Отправляем..." : "Отправить"}
        </button>
      </div>
    </form>
  );
}
