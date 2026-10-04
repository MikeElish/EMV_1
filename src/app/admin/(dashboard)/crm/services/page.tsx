import { prisma } from "@/lib/prisma";
import { ServicesTable } from "@/components/admin/ServicesTable";
import { CrmPage } from "@/components/admin/CrmTableFrame";

export default async function CrmServicesPage() {
  const services = await prisma.service.findMany({ orderBy: { name: "asc" } });
  return (
    <CrmPage>
      <ServicesTable services={services} />
    </CrmPage>
  );
}
