import { requireSection } from "@/lib/access-server";
import { CrmPage } from "@/components/admin/CrmTableFrame";

export default async function EmployeesPage() {
  await requireSection("crm.employees", "view");
  return (
    <CrmPage>
      <h1 className="text-2xl font-bold">Сотрудники</h1>
      <p className="mt-4 text-foreground/60">Раздел в разработке.</p>
    </CrmPage>
  );
}
