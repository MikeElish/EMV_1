import { prisma } from "@/lib/prisma";
import { createCompany } from "@/actions/crm/companies";
import { CompanyForm } from "@/components/admin/CompanyForm";

export default async function NewCompanyPage() {
  const managers = await prisma.user.findMany({
    where: { role: { not: "CUSTOMER" } },
    select: { id: true, lastName: true, firstName: true, login: true, role: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">Новая компания</h1>
      <CompanyForm managers={managers} onSubmit={createCompany} />
    </div>
  );
}
