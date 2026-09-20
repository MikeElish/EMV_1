import { prisma } from "@/lib/prisma";
import { DriverApplicationsTable } from "@/components/admin/DriverApplicationsTable";

export default async function DriverApplicationsPage() {
  const applications = await prisma.driverApplication.findMany({
    orderBy: { createdAt: "desc" },
  });

  return <DriverApplicationsTable applications={applications} />;
}
