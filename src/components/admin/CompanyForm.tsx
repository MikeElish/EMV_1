"use client";

import { useState, type FormEvent } from "react";
import type { CompanyInput } from "@/lib/validators/crm";
import {
  COMPANY_TYPE_SUGGESTIONS,
  COMPANY_PAYMENT_TYPES,
  COMPANY_PAYMENT_TYPE_LABELS,
  COMPANY_PRICE_TYPES,
  COMPANY_PRICE_TYPE_LABELS,
  ROLE_LABELS,
} from "@/lib/validators/crm";
import { lookupCompanyByInn, type ActionResult } from "@/actions/crm/companies";
import type { Party } from "@/lib/dadata";
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
  const [priceType, setPriceType] = useState(initial?.priceType ?? "WHOLESALE");
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [requisites, setRequisites] = useState({
    name: initial?.name ?? "",
    inn: initial?.inn ?? "",
    kpp: initial?.kpp ?? "",
    ogrn: initial?.ogrn ?? "",
    address: initial?.address ?? "",
  });
  const [lookup, setLookup] = useState<{ busy: boolean; message: string | null; warning: boolean }>({
    busy: false,
    message: null,
    warning: false,
  });
  const field = (key: keyof typeof requisites) => ({
    value: requisites[key],
    onChange: (e: { target: { value: string } }) => setRequisites((r) => ({ ...r, [key]: e.target.value })),
  });

  /** ЕГРЮЛ/ЕГРИП by ИНН. `overwrite` (the button) replaces what is typed; the automatic lookup only fills empty fields. */
  async function fillByInn(inn: string, overwrite: boolean) {
    setLookup({ busy: true, message: null, warning: false });
    const result = await lookupCompanyByInn(inn);
    if (!result.ok) {
      setLookup({ busy: false, message: result.error, warning: true });
      return;
    }
    const { party } = result;
    setRequisites((r) => {
      const pick = (current: string, found: string | null) => (overwrite || !current ? found ?? (overwrite ? "" : current) : current);
      return {
        ...r,
        name: pick(r.name, party.name),
        kpp: pick(r.kpp, party.kpp),
        ogrn: pick(r.ogrn, party.ogrn),
        address: pick(r.address, party.address),
      };
    });
    setLookup({ busy: false, ...describeParty(party) });
  }

  function onInnChange(value: string) {
    setRequisites((r) => ({ ...r, inn: value }));
    const digits = value.replace(/\D/g, "");
    // A new card: look it up as soon as the ИНН is complete.
    if (!requisites.name && (digits.length === 10 || digits.length === 12)) void fillByInn(digits, false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const deferralDaysRaw = String(formData.get("paymentDeferralDays") ?? "");
    const markupRaw = String(formData.get("individualMarkup") ?? "").trim();
    const result = await onSubmit({
      name: requisites.name,
      inn: requisites.inn || undefined,
      kpp: requisites.kpp || undefined,
      ogrn: requisites.ogrn || undefined,
      address: requisites.address || undefined,
      hasContract,
      contract: String(formData.get("contract") ?? "") || undefined,
      type: String(formData.get("type") ?? "") || undefined,
      managerId: String(formData.get("managerId") ?? "") || undefined,
      paymentType,
      paymentDeferralDays: deferralDaysRaw ? Number(deferralDaysRaw) : undefined,
      priceType,
      individualMarkup: markupRaw ? Number(markupRaw.replace(",", ".")) : undefined,
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
          {...field("name")}
          className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
        />
      </div>

      <div>
        <label htmlFor="inn" className="text-sm text-foreground/60">
          ИНН
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id="inn"
            name="inn"
            inputMode="numeric"
            value={requisites.inn}
            onChange={(e) => onInnChange(e.target.value)}
            className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
          />
          <button
            type="button"
            disabled={lookup.busy || !requisites.inn.trim()}
            onClick={() => void fillByInn(requisites.inn, true)}
            className="shrink-0 rounded-md border border-foreground/20 px-3 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {lookup.busy ? "Ищем..." : "Заполнить по ИНН"}
          </button>
        </div>
        {lookup.message && (
          <p className={`mt-1 text-sm ${lookup.warning ? "text-red-600" : "text-foreground/60"}`}>{lookup.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="kpp" className="text-sm text-foreground/60">
            КПП
          </label>
          <input
            id="kpp"
            name="kpp"
            inputMode="numeric"
            placeholder="у ИП нет"
            {...field("kpp")}
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
          />
        </div>
        <div>
          <label htmlFor="ogrn" className="text-sm text-foreground/60">
            ОГРН / ОГРНИП
          </label>
          <input
            id="ogrn"
            name="ogrn"
            inputMode="numeric"
            {...field("ogrn")}
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
          {...field("address")}
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="priceType" className="text-sm text-foreground/60">
            Тип цен
          </label>
          <select
            id="priceType"
            value={priceType}
            onChange={(e) => setPriceType(e.target.value as CompanyInput["priceType"])}
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
          >
            {COMPANY_PRICE_TYPES.map((value) => (
              <option key={value} value={value}>
                {COMPANY_PRICE_TYPE_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        {priceType === "INDIVIDUAL" && (
          <div>
            <label htmlFor="individualMarkup" className="text-sm text-foreground/60">
              Наценка к закупке, %
            </label>
            <input
              id="individualMarkup"
              name="individualMarkup"
              inputMode="decimal"
              required
              placeholder="например, 10"
              defaultValue={initial?.individualMarkup}
              className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
            />
          </div>
        )}
      </div>
      <p className="-mt-2 text-xs text-foreground/50">
        Сотрудники компании видят эти цены в магазине после входа; в CRM тип цен подставляется в новый заказ.
      </p>

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

const STATUS_WARNINGS: Partial<Record<NonNullable<Party["status"]>, string>> = {
  LIQUIDATING: "организация в процессе ликвидации",
  LIQUIDATED: "организация ликвидирована",
  BANKRUPT: "организация признана банкротом",
  REORGANIZING: "организация присоединяется к другому юрлицу",
};

function describeParty(party: Party): { message: string; warning: boolean } {
  const warning = party.status ? STATUS_WARNINGS[party.status] : undefined;
  if (warning) return { message: `Заполнено из ЕГРЮЛ: ${party.name} — внимание, ${warning}.`, warning: true };
  return { message: `Заполнено из ${party.individual ? "ЕГРИП" : "ЕГРЮЛ"}: ${party.name}. Проверьте и сохраните.`, warning: false };
}
