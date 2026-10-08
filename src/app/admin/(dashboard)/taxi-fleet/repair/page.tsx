import { prisma } from "@/lib/prisma";
import { getMyAccess } from "@/lib/access-server";
import { CrmPage } from "@/components/admin/CrmTableFrame";
import { RepairBoard } from "@/components/admin/RepairBoard";

// Ремонт: the register of repair cards on the left, the chosen card's works
// and materials on the right.
export default async function RepairPage() {
  const [repairs, vehicles, me] = await Promise.all([
    prisma.repair.findMany({
      include: {
        vehicle: { select: { brand: true, model: true, licensePlate: true } },
        lines: { orderBy: { createdAt: "asc" } },
        _count: { select: { documents: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    prisma.vehicle.findMany({
      select: { id: true, brand: true, model: true, licensePlate: true },
      orderBy: [{ brand: "asc" }, { model: "asc" }],
    }),
    getMyAccess(),
  ]);

  return (
    <CrmPage>
      <RepairBoard
        repairs={repairs.map((r) => ({
          id: r.id,
          date: r.date.toISOString().slice(0, 10),
          vehicleId: r.vehicleId,
          vehicleName: `${r.vehicle.brand} ${r.vehicle.model}`,
          plate: r.vehicle.licensePlate,
          type: r.type,
          shop: r.shop,
          status: r.status,
          note: r.note,
          files: r._count.documents,
          lines: r.lines.map((l) => ({
            id: l.id,
            kind: l.kind,
            productId: l.productId,
            serviceId: l.serviceId,
            name: l.name,
            quantity: l.quantity,
            price: l.price,
          })),
        }))}
        vehicles={vehicles.map((v) => ({ id: v.id, name: `${v.brand} ${v.model}`, plate: v.licensePlate }))}
        canDelete={me?.role === "OWNER"}
      />
    </CrmPage>
  );
}
