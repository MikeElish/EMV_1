import { createVehicle } from "@/actions/admin/vehicles";
import { VehicleForm, type VehicleFormInitial } from "@/components/admin/VehicleForm";
import { normalizePlate } from "@/lib/plate";
import { listFleetCars } from "@/lib/yandex-fleet-data";

export default async function NewVehiclePage({ searchParams }: PageProps<"/admin/taxi-fleet/tech/new">) {
  const { fleetCar } = await searchParams;

  // "Добавить в Технику" from the Яндекс.Флот reconciliation: pre-fill what
  // the Fleet knows; ПТС and the document dates are entered by hand.
  let initial: VehicleFormInitial | undefined;
  if (typeof fleetCar === "string") {
    const car = (await listFleetCars().catch(() => [])).find((c) => c.id === fleetCar);
    if (car) {
      initial = {
        brand: car.brand,
        model: car.model,
        licensePlate: normalizePlate(car.number),
        vin: car.vin,
        color: car.color,
        year: car.year ?? undefined,
        stsNumber: car.registrationCert,
      };
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Новое транспортное средство</h1>
      {initial && (
        <p className="mt-2 text-sm text-foreground/60">
          Данные подставлены из Яндекс.Флота — проверьте их и заполните ПТС и даты выдачи документов.
        </p>
      )}
      <VehicleForm onSubmit={createVehicle} initial={initial} />
    </div>
  );
}
