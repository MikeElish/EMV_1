"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Company, Role } from "@prisma/client";
import { updateCompany, deleteCompany } from "@/actions/crm/companies";
import { CompanyForm } from "@/components/admin/CompanyForm";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { Modal } from "@/components/Modal";
import { TableSearchInput } from "@/components/admin/TableSearchInput";
import { CompanyBalanceTab, type CompanyOrderRow } from "@/components/admin/CompanyBalanceTab";
import { formatRub } from "@/lib/money";

type Manager = { id: string; lastName: string | null; firstName: string | null; login: string; role: Role };

export type CompanyBalance = { balance: number; orders: CompanyOrderRow[] };

type Tab = "info" | "balance";

const TAB_LABELS: Record<Tab, string> = {
  info: "Основная информация",
  balance: "Баланс",
};

export function CompaniesTable({
  companies,
  managers,
  balances,
}: {
  companies: Company[];
  managers: Manager[];
  balances: Record<string, CompanyBalance>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Company | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("info");
  const [search, setSearch] = useState("");

  function openCompany(company: Company, tab: Tab = "info") {
    setSelected(company);
    setActiveTab(tab);
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return companies;
    return companies.filter((company) =>
      [company.name, company.inn, company.ogrn, company.address, company.contract, company.type]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [companies, search]);

  function close() {
    setSelected(null);
    router.refresh();
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/crm/companies/new"
            aria-label="Добавить компанию"
            className="flex h-8 w-8 items-center justify-center rounded-md bg-green-600 text-lg font-bold leading-none text-white transition-opacity hover:opacity-90"
          >
            +
          </Link>
          <h1 className="text-lg font-semibold">Компании</h1>
        </div>
        <TableSearchInput value={search} onChange={setSearch} placeholder="Поиск по компаниям..." />
      </div>

      {companies.length === 0 ? (
        <p className="mt-4 text-sm text-foreground/40">Компаний пока нет.</p>
      ) : filtered.length === 0 ? (
        <p className="mt-4 text-sm text-foreground/40">Ничего не найдено.</p>
      ) : (
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-foreground/10 text-left text-foreground/50">
              <th className="py-2 pr-4">Наименование</th>
              <th className="py-2 pr-4">ИНН</th>
              <th className="py-2 pr-4">ОГРН</th>
              <th className="py-2 pr-4">Адрес</th>
              <th className="py-2 pr-4">Договор</th>
              <th className="py-2 pr-4">Роль</th>
              <th className="py-2 pr-4">Баланс</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((company) => {
              const balance = balances[company.id]?.balance ?? 0;
              return (
                <tr
                  key={company.id}
                  onClick={() => openCompany(company)}
                  className="cursor-pointer border-b border-foreground/10 hover:bg-foreground/5"
                >
                  <td className="py-2 pr-4">{company.name}</td>
                  <td className="py-2 pr-4">{company.inn ?? "—"}</td>
                  <td className="py-2 pr-4">{company.ogrn ?? "—"}</td>
                  <td className="py-2 pr-4">{company.address ?? "—"}</td>
                  <td className="py-2 pr-4">{company.contract ?? "—"}</td>
                  <td className="py-2 pr-4">{company.type ?? "—"}</td>
                  <td className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openCompany(company, "balance");
                      }}
                      className={`font-medium hover:underline ${
                        balance > 0
                          ? "text-green-600"
                          : balance < 0
                            ? "text-red-600"
                            : "text-foreground/60"
                      }`}
                    >
                      {formatRub(balance)}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {selected && (
        <Modal onClose={() => setSelected(null)} maxWidthClassName="max-w-4xl">
          <h2 className="text-xl font-bold">Компания: {selected.name}</h2>

          <div className="mt-4 flex gap-4 border-b border-foreground/10">
            {(Object.keys(TAB_LABELS) as Tab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`-mb-px border-b-2 px-1 pb-2 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? "border-foreground text-foreground"
                    : "border-transparent text-foreground/50 hover:text-foreground"
                }`}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>

          {activeTab === "info" ? (
            <>
              <CompanyForm
                managers={managers}
                companyId={selected.id}
                initial={{
                  name: selected.name,
                  inn: selected.inn ?? undefined,
                  ogrn: selected.ogrn ?? undefined,
                  address: selected.address ?? undefined,
                  hasContract: selected.hasContract,
                  contract: selected.contract ?? undefined,
                  type: selected.type ?? undefined,
                  managerId: selected.managerId ?? undefined,
                  paymentType: selected.paymentType,
                  paymentDeferralDays: selected.paymentDeferralDays ?? undefined,
                }}
                onSubmit={(input) => updateCompany(selected.id, input)}
                onSuccess={close}
              />

              <div className="mt-6 flex justify-end">
                <DeleteButton
                  action={async () => {
                    const result = await deleteCompany(selected.id);
                    if (result.ok) close();
                    return result;
                  }}
                  confirmText={`Удалить компанию «${selected.name}»?`}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                />
              </div>
            </>
          ) : (
            <CompanyBalanceTab orders={balances[selected.id]?.orders ?? []} />
          )}
        </Modal>
      )}
    </>
  );
}
