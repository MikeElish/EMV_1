import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CompaniesTable } from "@/components/admin/CompaniesTable";

export default async function CrmCompaniesPage() {
  const companies = await prisma.company.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div>
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

      <div className="mt-4 overflow-x-auto">
        <CompaniesTable companies={companies} />
      </div>
    </div>
  );
}
