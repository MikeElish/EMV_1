import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { OneCError } from "@/lib/onec";
import { balances, getWarehouseData } from "@/lib/onec-warehouse";
import { CrmPage } from "@/components/admin/CrmTableFrame";
import { WarehouseTable } from "@/components/admin/WarehouseTable";
import { requireSection } from "@/lib/access-server";

export default async function WarehousePage({ params }: PageProps<"/admin/warehouse/[ref]">) {
  await requireSection("warehouse.stock", "view");
  const { ref } = await params;
  let data: Awaited<ReturnType<typeof getWarehouseData>>;
  try {
    data = await getWarehouseData();
  } catch (error) {
    return (
      <CrmPage>
        <p className="text-sm text-red-600">
          {error instanceof OneCError ? error.message : "1С не ответила — остатки по складам недоступны, попробуйте позже."}
        </p>
      </CrmPage>
    );
  }
  const warehouse = data.warehouses.find((w) => w.ref === ref);
  if (!warehouse) notFound();

  const places = new Map(
    (await prisma.storagePlace.findMany({ where: { warehouseRef: ref } })).map((p) => [p.itemRef, p.place])
  );
  const rows = [...balances(data.movements, ref)]
    // Floating sums of 1С quantities: 0.30000000004 → 0.3.
    .map(([itemRef, qty]) => ({ itemRef, qty: Math.round(qty * 1000) / 1000 }))
    .filter((r) => r.qty !== 0)
    .map((r) => ({
      ...r,
      name: data.items[r.itemRef]?.name ?? "—",
      sku: data.items[r.itemRef]?.sku ?? "",
      productId: data.items[r.itemRef]?.productId ?? null,
      place: places.get(r.itemRef) ?? "",
    }));

  return (
    <CrmPage>
      <WarehouseTable warehouse={warehouse} warehouses={data.warehouses} rows={rows} loadedAt={data.loadedAt} />
    </CrmPage>
  );
}
