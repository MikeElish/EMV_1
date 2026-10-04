import { prisma } from "@/lib/prisma";
import { FuelTable } from "@/components/admin/FuelTable";
import { listFleetDrivers, isFleetConfigured } from "@/lib/yandex-fleet-data";

/** Driver names to suggest: park drivers on the site, in Яндекс.Флот and from earlier receipts. */
async function driverNames(previous: string[]) {
  const names = new Set(previous);
  const users = await prisma.user.findMany({
    where: { role: "DRIVER" },
    select: { lastName: true, firstName: true, patronymic: true },
  });
  for (const u of users) {
    const name = [u.lastName, u.firstName, u.patronymic].filter(Boolean).join(" ");
    if (name) names.add(name);
  }
  try {
    if (await isFleetConfigured()) for (const d of await listFleetDrivers()) if (d.name) names.add(d.name);
  } catch {
    // Яндекс.Флот unavailable -- the other sources are enough
  }
  return [...names].sort((a, b) => a.localeCompare(b, "ru"));
}

export default async function FuelPage() {
  const [receipts, vehicles] = await Promise.all([
    prisma.fuelReceipt.findMany({
      include: { vehicle: { select: { brand: true, model: true, licensePlate: true } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    prisma.vehicle.findMany({
      select: { id: true, brand: true, model: true, licensePlate: true },
      orderBy: [{ brand: "asc" }, { model: "asc" }],
    }),
  ]);

  const stations = new Map<string, string>();
  for (const r of receipts) if (!stations.has(r.stationInn)) stations.set(r.stationInn, r.stationName);

  return (
    <FuelTable
      receipts={receipts}
      vehicles={vehicles.map((v) => ({ id: v.id, label: `${v.brand} ${v.model} — ${v.licensePlate}`, plate: v.licensePlate }))}
      drivers={await driverNames(receipts.map((r) => r.driverName))}
      stations={[...stations].map(([inn, name]) => ({ inn, name }))}
    />
  );
}
