import { FitWidth } from "@/components/FitWidth";
import { prisma } from "@/lib/prisma";
import { reconcileWithFleet } from "@/lib/fleet-reconcile";
import { VehiclesTable } from "@/components/admin/VehiclesTable";
import { FleetOnlyCars } from "@/components/admin/FleetOnlyCars";

export default async function CrmTechPage() {
  const vehicles = await prisma.vehicle.findMany({ orderBy: { createdAt: "desc" } });
  const fleet = await reconcileWithFleet(vehicles);

  return (
    <FitWidth className="overflow-x-auto">
      <VehiclesTable vehicles={vehicles} fleetLinks={fleet.configured && "links" in fleet ? fleet.links : null} />
      {fleet.configured && "error" in fleet && (
        <p className="mt-4 text-sm text-red-600">Сверка с Яндекс.Флотом недоступна: {fleet.error}</p>
      )}
      {fleet.configured && "fleetOnly" in fleet && <FleetOnlyCars cars={fleet.fleetOnly} />}
    </FitWidth>
  );
}
