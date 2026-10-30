import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { OneCError } from "@/lib/onec";
import { balances, getWarehouseData } from "@/lib/onec-warehouse";
import { itemPrices } from "@/actions/admin/warehouse";
import { CrmPage } from "@/components/admin/CrmTableFrame";
import { InventorySheet } from "@/components/admin/InventorySheet";

export default async function InventoryPage({ params }: PageProps<"/admin/warehouse/[ref]/inventory">) {
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
  const book = [...balances(data.movements, ref)]
    .map(([itemRef, qty]) => ({ itemRef, qty: Math.round(qty * 1000) / 1000 }))
    .filter((r) => r.qty !== 0);
  const prices = await itemPrices(book.map((r) => r.itemRef));
  const rows = book.map((r) => ({
    itemRef: r.itemRef,
    name: data.items[r.itemRef]?.name ?? "—",
    sku: data.items[r.itemRef]?.sku ?? "",
    place: places.get(r.itemRef) ?? "",
    book: r.qty,
    price: prices[r.itemRef] ?? null,
  }));

  return (
    <CrmPage>
      <InventorySheet warehouse={warehouse} rows={rows} />
    </CrmPage>
  );
}
