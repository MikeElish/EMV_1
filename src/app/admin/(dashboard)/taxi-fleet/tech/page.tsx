import { prisma } from "@/lib/prisma";
import { VehiclesTable } from "@/components/admin/VehiclesTable";

export default async function CrmTechPage() {
  const vehicles = await prisma.vehicle.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="overflow-x-auto">
      <VehiclesTable vehicles={vehicles} />
    </div>
  );
}
