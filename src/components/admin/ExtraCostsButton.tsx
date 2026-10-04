"use client";

import { useState } from "react";
import Link from "next/link";
import { formatRub } from "@/lib/money";
import { Modal } from "@/components/Modal";

export type ExtraCostRow = {
  id: string;
  number: string;
  date: Date;
  amount: number;
  service: { name: string } | null;
};

/** «Доп.расходы» of an order: the sum; a click lists the documents behind it. */
export function ExtraCostsButton({
  orderNumber,
  costs,
  total,
}: {
  orderNumber: string;
  costs: ExtraCostRow[];
  total: number;
}) {
  const [open, setOpen] = useState(false);
  if (!costs.length) return <span className="text-foreground/50">{formatRub(0)}</span>;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Показать документы"
        className="font-medium text-blue-600 underline underline-offset-4 hover:opacity-80 dark:text-blue-400"
      >
        {formatRub(total)}
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)} maxWidthClassName="max-w-xl">
          <h2 className="text-lg font-semibold">Доп.расходы</h2>
          <p className="mt-1 text-sm text-foreground/60">Заказ {orderNumber}</p>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-foreground/10 text-left text-foreground/50">
                <th className="py-2 pr-4">Документ</th>
                <th className="py-2 pr-4">Услуга</th>
                <th className="py-2 text-right">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {costs.map((c) => (
                <tr key={c.id} className="border-b border-foreground/10">
                  <td className="py-2 pr-4">
                    <Link
                      href={`/admin/crm/extra-costs?number=${encodeURIComponent(c.number)}`}
                      className="font-medium underline underline-offset-4 hover:opacity-80"
                    >
                      № {c.number}
                    </Link>
                    <span className="ml-2 text-xs text-foreground/50">
                      от {new Date(c.date).toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" })}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-foreground/70">{c.service?.name ?? "—"}</td>
                  <td className="py-2 text-right">{formatRub(c.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
    </>
  );
}
