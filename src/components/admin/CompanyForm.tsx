"use client";

import { useState, type FormEvent } from "react";
import type { CompanyInput } from "@/lib/validators/crm";
import {
  COMPANY_TYPE_SUGGESTIONS,
  COMPANY_PAYMENT_TYPES,
  COMPANY_PAYMENT_TYPE_LABELS,
  ROLE_LABELS,
} from "@/lib/validators/crm";
import type { ActionResult } from "@/actions/crm/companies";
import type { Role } from "@prisma/client";
import { CompanyDocumentsModal } from "@/components/admin/CompanyDocumentsModal";

type Manager = { id: string; lastName: string | null; firstName: string | null; login: string; role: Role };

export function CompanyForm({
  managers,
  initial,
  onSubmit,
  onSuccess,
  companyId,
}: {
  managers: Manager[];
  initial?: Partial<CompanyInput>;
  onSubmit: (input: CompanyInput) => Promise<ActionResult>;
  onSuccess?: () => void;
  /** Only set when editing an existing company -- shows the "Файлы" button. */
  companyId?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hasContract, setHasContract] = useState(initial?.hasContract ?? false);
  const [paymentType, setPaymentType] = useState(initial?.paymentType ?? "PREPAYMENT");
  const [documentsOpen, setDocumentsOpen] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const deferralDaysRaw = String(formData.get("paymentDeferralDays") ?? "");
    const result = await onSubmit({
      name: String(formData.get("name") ?? ""),
      inn: String(formData.get("inn") ?? "") || undefined,
      ogrn: String(formData.get("ogrn") ?? "") || undefined,
      address: String(formData.get("address") ?? "") || undefined,
      hasContract,
      contract: String(formData.get("contract") ?? "") || undefined,
      type: String(formData.get("type") ?? "") || undefined,
      managerId: String(formData.get("managerId") ?? "") || undefined,
      paymentType,
      paymentDeferralDays: deferralDaysRaw ? Number(deferralDaysRaw) : undefined,
    });

    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSuccess?.();
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
          <label htmlFor="contract" className="flex items-center gap-2 text-sm text-foreground/60">
            <input
              type="checkbox"
              checked={hasContract}
              onChange={(e) => setHasContract(e.target.checked)}
            />
            Договор
          </label>
          <input
            id="contract"
            name="contract"
            disabled={!hasContract}
            placeholder="Номер/реквизиты договора"
            defaultValue={initial?.contract}
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50 disabled:opacity-40"
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="paymentType" className="text-sm text-foreground/60">
            Вид оплаты
          </label>
          <select
            id="paymentType"
            value={paymentType}
            onChange={(e) => setPaymentType(e.target.value as CompanyInput["paymentType"])}
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
          >
            {COMPANY_PAYMENT_TYPES.map((value) => (
              <option key={value} value={value}>
                {COMPANY_PAYMENT_TYPE_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        {paymentType === "DEFERRED" && (
          <div>
            <label htmlFor="paymentDeferralDays" className="text-sm text-foreground/60">
              Количество дней
            </label>
            <input
              id="paymentDeferralDays"
              name="paymentDeferralDays"
              type="number"
              min={1}
              required
              defaultValue={initial?.paymentDeferralDays}
              className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
            />
          </div>
        )}
      </div>

      <div>
        <label htmlFor="managerId" className="text-sm text-foreground/60">
          Закреплённый менеджер
        </label>
        <select
          id="managerId"
          name="managerId"
          defaultValue={initial?.managerId ?? ""}
          className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
        >
          <option value="">— не назначен —</option>
          {managers.map((m) => {
            const fullName = [m.lastName, m.firstName].filter(Boolean).join(" ") || m.login;
            return (
              <option key={m.id} value={m.id}>
                {fullName} — {ROLE_LABELS[m.role]}
              </option>
            );
          })}
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-foreground px-6 py-2 font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Сохраняем..." : "Сохранить"}
        </button>
        {companyId && (
          <button
            type="button"
            onClick={() => setDocumentsOpen(true)}
            className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
          >
            Файлы
          </button>
        )}
      </div>

      {companyId && documentsOpen && (
        <CompanyDocumentsModal
          companyId={companyId}
          companyName={initial?.name ?? ""}
          onClose={() => setDocumentsOpen(false)}
        />
      )}
    </form>
  );
}
