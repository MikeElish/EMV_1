"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { saveWarehouse } from "@/actions/admin/warehouse";
import { Modal } from "@/components/Modal";

type Card = { ref: string; name: string; type: string; comment: string; deleted: boolean };

const inputClass =
  "mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/50";

function WarehouseForm({ card, types, onClose }: { card: Card | null; types: Record<string, string>; onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await saveWarehouse(card?.ref ?? null, {
        name: String(form.get("name") ?? ""),
        type: String(form.get("type") ?? ""),
        comment: String(form.get("comment") ?? ""),
      });
      if (!result.ok) return setError(result.error);
      router.refresh();
      onClose();
    });
  }

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-lg">
      <h2 className="text-lg font-semibold">{card ? "Изменить склад" : "Новый склад"}</h2>
      <p className="mt-1 text-xs text-foreground/50">Склад сохраняется в справочник «Склады» 1С.</p>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <div>
          <label htmlFor="wh-name" className="text-sm text-foreground/60">
            Название *
          </label>
          <input id="wh-name" name="name" required maxLength={100} defaultValue={card?.name} className={inputClass} />
        </div>
        <div>
          <label htmlFor="wh-type" className="text-sm text-foreground/60">
            Тип склада
          </label>
          <select id="wh-type" name="type" defaultValue={card?.type ?? "ОптовыйСклад"} className={`${inputClass} bg-background`}>
            {Object.entries(types).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="wh-comment" className="text-sm text-foreground/60">
            Комментарий (адрес, ответственный…)
          </label>
          <textarea id="wh-comment" name="comment" rows={3} maxLength={500} defaultValue={card?.comment} className={inputClass} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-foreground px-5 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Сохраняем в 1С..." : "Сохранить"}
        </button>
      </form>
    </Modal>
  );
}

export function WarehousesSettings({ warehouses, types }: { warehouses: Card[]; types: Record<string, string> }) {
  const [editing, setEditing] = useState<Card | "new" | null>(null);

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Склады</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Справочник складов 1С. Каждый склад — отдельная вкладка в разделе «Склад».
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="shrink-0 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          Добавить склад
        </button>
      </div>

      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b border-foreground/10 text-left text-foreground/50">
            <th className="py-2 pr-3">Название</th>
            <th className="py-2 pr-3">Тип</th>
            <th className="py-2 pr-3">Комментарий</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {warehouses.map((w) => (
            <tr key={w.ref} className={`border-b border-foreground/10 ${w.deleted ? "text-foreground/40" : ""}`}>
              <td className="py-2 pr-3 font-medium">
                {w.name}
                {w.deleted && <span className="ml-2 text-xs">(помечен на удаление в 1С)</span>}
              </td>
              <td className="py-2 pr-3 text-foreground/70">{types[w.type] ?? w.type}</td>
              <td className="py-2 pr-3 text-foreground/70">{w.comment || "—"}</td>
              <td className="py-2 text-right">
                <button type="button" onClick={() => setEditing(w)} className="text-sm underline underline-offset-4">
                  Изменить
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editing && <WarehouseForm card={editing === "new" ? null : editing} types={types} onClose={() => setEditing(null)} />}
    </div>
  );
}
