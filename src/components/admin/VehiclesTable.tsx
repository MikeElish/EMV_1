"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Vehicle } from "@prisma/client";
import { updateVehicle, deleteVehicle } from "@/actions/admin/vehicles";
import { VehicleForm } from "@/components/admin/VehicleForm";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { Modal } from "@/components/Modal";
import { VEHICLE_STATUS_LABELS } from "@/lib/validators/taxi-fleet";
import type { FleetLink } from "@/lib/fleet-reconcile";

function toInputValue(date: Date): string {
  return new Date(date).toISOString().slice(0, 10);
}

export function VehiclesTable({
  vehicles,
  fleetLinks,
}: {
  vehicles: Vehicle[];
  /** Match with Яндекс.Флот per vehicle; null when the Fleet isn't connected. */
  fleetLinks: Record<string, FleetLink | null> | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Vehicle | null>(null);

  function close() {
    setSelected(null);
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <Link
          href="/admin/taxi-fleet/tech/new"
          aria-label="Добавить транспортное средство"
          className="flex h-8 w-8 items-center justify-center rounded-md bg-green-600 text-lg font-bold leading-none text-white transition-opacity hover:opacity-90"
        >
          +
        </Link>
        <h1 className="text-lg font-semibold">Техника</h1>
      </div>

      {vehicles.length === 0 ? (
        <p className="mt-4 text-sm text-foreground/40">Техники пока нет.</p>
      ) : (
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-foreground/10 text-left text-foreground/50">
              <th className="py-2 pr-4">Марка</th>
              <th className="py-2 pr-4">Модель</th>
              <th className="py-2 pr-4">Гос.номер</th>
              <th className="py-2 pr-4">Статус</th>
              {fleetLinks && <th className="py-2 pr-4">Яндекс.Флот</th>}
            </tr>
          </thead>
          <tbody>
            {vehicles.map((vehicle) => (
              <tr
                key={vehicle.id}
                onClick={() => setSelected(vehicle)}
                className="cursor-pointer border-b border-foreground/10 hover:bg-foreground/5"
              >
                <td className="py-2 pr-4">{vehicle.brand}</td>
                <td className="py-2 pr-4">{vehicle.model}</td>
                <td className="py-2 pr-4">{vehicle.licensePlate}</td>
                <td className="py-2 pr-4">{VEHICLE_STATUS_LABELS[vehicle.status]}</td>
                {fleetLinks && (
                  <td className="py-2 pr-4">
                    {fleetLinks[vehicle.id] ? (
                      <span className="text-green-600">
                        ✓ есть
                        {fleetLinks[vehicle.id]!.callsign && (
                          <span className="ml-1 text-xs text-foreground/50">
                            позывной {fleetLinks[vehicle.id]!.callsign}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-foreground/40">нет во Флоте</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selected && (
        <Modal onClose={() => setSelected(null)} maxWidthClassName="max-w-xl">
          <h2 className="text-xl font-bold">
            {selected.brand} {selected.model} — {selected.licensePlate}
          </h2>
          <VehicleForm
            vehicleId={selected.id}
            vehicleName={`${selected.brand} ${selected.model} — ${selected.licensePlate}`}
            initial={{
              brand: selected.brand,
              model: selected.model,
              licensePlate: selected.licensePlate,
              vin: selected.vin,
              color: selected.color,
              year: selected.year,
              ptsNumber: selected.ptsNumber,
              ptsIssueDate: toInputValue(selected.ptsIssueDate),
              stsNumber: selected.stsNumber,
              stsIssueDate: toInputValue(selected.stsIssueDate),
            }}
            onSubmit={(formData) => updateVehicle(selected.id, formData)}
            onSuccess={close}
          />

          <div className="mt-6 flex justify-end">
            <DeleteButton
              action={async () => {
                const result = await deleteVehicle(selected.id);
                if (result.ok) close();
                return result;
              }}
              confirmText={`Удалить автомобиль «${selected.brand} ${selected.model} (${selected.licensePlate})»?`}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
