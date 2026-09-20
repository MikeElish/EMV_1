import { prisma } from "@/lib/prisma";
import { CompaniesTable } from "@/components/admin/CompaniesTable";

export default async function CrmCompaniesPage() {
  const [companies, managers] = await Promise.all([
    prisma.company.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.user.findMany({
      where: { role: { not: "CUSTOMER" } },
      select: { id: true, lastName: true, firstName: true, login: true, role: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <div className="overflow-x-auto">
      <CompaniesTable companies={companies} managers={managers} />
    </div>
  );
}
