import { createCompany } from "@/actions/crm/companies";
import { CompanyForm } from "@/components/admin/CompanyForm";

export default function NewCompanyPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Новая компания</h1>
      <CompanyForm onSubmit={createCompany} />
    </div>
  );
}
