"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
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

type Language = "ru" | "en" | "zh";

const TEXT: Record<Language, Record<string, string>> = {
  ru: {
    attach: "Вложить документы",
    allowedFiles: "Допустимы PDF, Excel, Word или изображения. Максимальный размер одного файла — 20 МБ.",
    remove: "Удалить",
    submit: "Отправить",
    submitting: "Отправляем...",
    noFilesError: "Выберите хотя бы один документ",
    number: "№",
    brand: "Бренд",
    name: "Наименование",
    sku: "Артикул",
    source: "Назначение",
    quantity: "Количество",
    price: "Цена",
    cost: "Стоимость",
    delivery: "Срок поставки",
    total: "Итого",
    submittedTitle: "Документы отправлены",
    submittedText: "Спасибо! Мы проверим счёт и свяжемся при необходимости.",
  },
  en: {
    attach: "Attach documents",
    allowedFiles: "PDF, Excel, Word or images are allowed. Max 20 MB per file.",
    remove: "Remove",
    submit: "Submit",
    submitting: "Submitting...",
    noFilesError: "Please select at least one document",
    number: "No.",
    brand: "Brand",
    name: "Item name",
    sku: "Part number",
    source: "Purpose",
    quantity: "Quantity",
    price: "Price",
    cost: "Cost",
    delivery: "Delivery time",
    total: "Total",
    submittedTitle: "Documents sent",
    submittedText: "Thank you! We will review the invoice and contact you if needed.",
  },
  zh: {
    attach: "上传文件",
    allowedFiles: "允许 PDF、Excel、Word 或图片。单个文件最大 20 MB。",
    remove: "删除",
    submit: "提交",
    submitting: "正在提交...",
    noFilesError: "请至少选择一个文件",
    number: "序号",
    brand: "品牌",
    name: "商品名称",
    sku: "零件号",
    source: "用途",
    quantity: "数量",
    price: "价格",
    cost: "金额",
    delivery: "交货时间",
    total: "总计",
    submittedTitle: "文件已发送",
    submittedText: "谢谢！我们会审核发票并在需要时与您联系。",
  },
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
  const [language, setLanguage] = useState<Language>("ru");
  const t = TEXT[language];
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const saved = window.localStorage.getItem("supplier-invoice-language");
      if (saved === "ru" || saved === "en" || saved === "zh") setLanguage(saved);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function changeLanguage(value: string) {
    if (value !== "ru" && value !== "en" && value !== "zh") return;
    setLanguage(value);
    window.localStorage.setItem("supplier-invoice-language", value);
  }

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
      setError(t.noFilesError);
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
        <h2 className="text-xl font-semibold">{t.submittedTitle}</h2>
        <p className="mt-2 text-sm text-green-700">{t.submittedText}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="flex justify-end">
        <label className="sr-only" htmlFor="supplier-invoice-language">Language</label>
        <select
          id="supplier-invoice-language"
          value={language}
          onChange={(event) => changeLanguage(event.target.value)}
          className="rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm"
        >
          <option value="en">English</option>
          <option value="ru">Русский</option>
          <option value="zh">中文</option>
        </select>
      </div>

      <div className="space-y-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium hover:bg-foreground/5">
          <span>{t.attach}</span>
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
                  {t.remove}
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-foreground/50">{t.allowedFiles}</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-foreground/10">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-foreground/[0.03] text-left text-foreground/60">
            <tr>
              <th className="px-3 py-2">{t.number}</th>
              <th className="px-3 py-2">{t.brand}</th>
              <th className="px-3 py-2">{t.name}</th>
              <th className="px-3 py-2">{t.sku}</th>
              <th className="px-3 py-2">{t.source}</th>
              <th className="px-3 py-2 text-right">{t.quantity}</th>
              <th className="px-3 py-2 text-right">{t.price}, {currency}</th>
              <th className="px-3 py-2 text-right">{t.cost}, {currency}</th>
              <th className="px-3 py-2 text-right">{t.delivery}</th>
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
                {t.total}
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
          {pending ? t.submitting : t.submit}
        </button>
      </div>
    </form>
  );
}
