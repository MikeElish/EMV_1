import { requireSection } from "@/lib/access-server";
import { CrmPage } from "@/components/admin/CrmTableFrame";
import { SectionStub } from "@/components/admin/SectionStub";

export default async function EmployeesPage() {
  await requireSection("crm.employees", "view");
  return (
    <CrmPage>
      <h1 className="text-2xl font-bold">Сотрудники</h1>
      <SectionStub title="Сотрудники" />
    </CrmPage>
  );
}
