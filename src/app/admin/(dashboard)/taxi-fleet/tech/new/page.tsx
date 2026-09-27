import { createVehicle } from "@/actions/admin/vehicles";
import { VehicleForm } from "@/components/admin/VehicleForm";

export default function NewVehiclePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Новое транспортное средство</h1>
      <VehicleForm onSubmit={createVehicle} />
    </div>
  );
}
