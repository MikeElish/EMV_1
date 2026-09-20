"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Company, Role } from "@prisma/client";
import { updateCompany, deleteCompany } from "@/actions/crm/companies";
import { CompanyForm } from "@/components/admin/CompanyForm";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { Modal } from "@/components/Modal";

type Manager = { id: string; lastName: string | null; firstName: string | null; login: string; role: Role };

export function CompaniesTable({
  companies,
  managers,
}: {
  companies: Company[];
  managers: Manager[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Company | null>(null);

  if (companies.length === 0) {
    return <p className="text-sm text-foreground/40">Компаний пока нет.</p>;
  }

  function close() {
    setSelected(null);
    router.refresh();
  }

  return (
    <>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-foreground/10 text-left text-foreground/50">
            <th className="py-2 pr-4">Наименование</th>
            <th className="py-2 pr-4">ИНН</th>
            <th className="py-2 pr-4">ОГРН</th>
            <th className="py-2 pr-4">Адрес</th>
            <th className="py-2 pr-4">Договор</th>
            <th className="py-2 pr-4">Роль</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((company) => (
            <tr
              key={company.id}
              onClick={() => setSelected(company)}
              className="cursor-pointer border-b border-foreground/10 hover:bg-foreground/5"
            >
              <td className="py-2 pr-4">{company.name}</td>
              <td className="py-2 pr-4">{company.inn ?? "—"}</td>
              <td className="py-2 pr-4">{company.ogrn ?? "—"}</td>
              <td className="py-2 pr-4">{company.address ?? "—"}</td>
              <td className="py-2 pr-4">{company.contract ?? "—"}</td>
              <td className="py-2 pr-4">{company.type ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {selected && (
        <Modal onClose={() => setSelected(null)} maxWidthClassName="max-w-2xl">
          <h2 className="text-xl font-bold">Компания: {selected.name}</h2>
          <CompanyForm
            managers={managers}
            initial={{
              name: selected.name,
              inn: selected.inn ?? undefined,
              ogrn: selected.ogrn ?? undefined,
              address: selected.address ?? undefined,
              contract: selected.contract ?? undefined,
              type: selected.type ?? undefined,
              managerId: selected.managerId ?? undefined,
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
        </Modal>
      )}
    </>
  );
}
