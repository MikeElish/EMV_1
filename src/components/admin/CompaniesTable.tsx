"use client";

import { useRouter } from "next/navigation";
import type { Company } from "@prisma/client";

export function CompaniesTable({ companies }: { companies: Company[] }) {
  const router = useRouter();

  if (companies.length === 0) {
    return <p className="text-sm text-foreground/40">Компаний пока нет.</p>;
  }

  return (
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
            onClick={() => router.push(`/admin/crm/companies/${company.id}`)}
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
  );
}
