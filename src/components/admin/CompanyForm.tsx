"use client";

import { useState, type FormEvent } from "react";
import type { CompanyInput } from "@/lib/validators/crm";
import { COMPANY_TYPE_SUGGESTIONS } from "@/lib/validators/crm";
import type { ActionResult } from "@/actions/crm/companies";

export function CompanyForm({
  initial,
  onSubmit,
}: {
  initial?: Partial<CompanyInput>;
  onSubmit: (input: CompanyInput) => Promise<ActionResult>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const result = await onSubmit({
      name: String(formData.get("name") ?? ""),
      inn: String(formData.get("inn") ?? "") || undefined,
      ogrn: String(formData.get("ogrn") ?? "") || undefined,
      address: String(formData.get("address") ?? "") || undefined,
      contract: String(formData.get("contract") ?? "") || undefined,
      type: String(formData.get("type") ?? "") || undefined,
    });

    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 max-w-xl space-y-4">
      <div>
        <label htmlFor="name" className="text-sm text-foreground/60">
          Наименование
        </label>
        <input
          id="name"
          name="name"
          required
          defaultValue={initial?.name}
          className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="inn" className="text-sm text-foreground/60">
            ИНН
          </label>
          <input
            id="inn"
            name="inn"
            defaultValue={initial?.inn}
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
          />
        </div>
        <div>
          <label htmlFor="ogrn" className="text-sm text-foreground/60">
            ОГРН
          </label>
          <input
            id="ogrn"
            name="ogrn"
            defaultValue={initial?.ogrn}
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
          />
        </div>
      </div>

      <div>
        <label htmlFor="address" className="text-sm text-foreground/60">
          Адрес
        </label>
        <input
          id="address"
          name="address"
          defaultValue={initial?.address}
          className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="contract" className="text-sm text-foreground/60">
            Договор
          </label>
          <input
            id="contract"
            name="contract"
            placeholder="Номер/реквизиты договора"
            defaultValue={initial?.contract}
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
          />
        </div>
        <div>
          <label htmlFor="type" className="text-sm text-foreground/60">
            Роль
          </label>
          <input
            id="type"
            name="type"
            list="company-type-suggestions"
            placeholder="Клиент, Поставщик..."
            defaultValue={initial?.type}
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
          />
          <datalist id="company-type-suggestions">
            {COMPANY_TYPE_SUGGESTIONS.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-foreground px-6 py-2 font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Сохраняем..." : "Сохранить"}
      </button>
    </form>
  );
}
