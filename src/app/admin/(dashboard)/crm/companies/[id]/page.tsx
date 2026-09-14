import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateCompany, deleteCompany } from "@/actions/crm/companies";
import { CompanyForm } from "@/components/admin/CompanyForm";
import { DeleteButton } from "@/components/admin/DeleteButton";

export default async function EditCompanyPage({
  params,
}: PageProps<"/admin/crm/companies/[id]">) {
  const { id } = await params;
  const company = await prisma.company.findUnique({ where: { id } });
  if (!company) notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold">Компания: {company.name}</h1>
      <CompanyForm
        initial={{
          name: company.name,
          inn: company.inn ?? undefined,
          ogrn: company.ogrn ?? undefined,
          address: company.address ?? undefined,
          contract: company.contract ?? undefined,
          type: company.type ?? undefined,
        }}
        onSubmit={(input) => updateCompany(id, input)}
      />

      <div className="mt-6 flex justify-end">
        <DeleteButton
          action={deleteCompany.bind(null, id)}
          confirmText={`Удалить компанию «${company.name}»?`}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        />
      </div>
    </div>
  );
}
