import { redirect } from "next/navigation";
import { OneCError } from "@/lib/onec";
import { getWarehouseData } from "@/lib/onec-warehouse";
import { requireSection } from "@/lib/access-server";

export default async function WarehouseIndexPage() {
  await requireSection("warehouse.stock", "view");
  let warehouses: Awaited<ReturnType<typeof getWarehouseData>>["warehouses"];
  try {
    ({ warehouses } = await getWarehouseData());
  } catch (error) {
    return (
      <p className="text-sm text-red-600">
        {error instanceof OneCError ? error.message : "1С не ответила — остатки по складам недоступны, попробуйте позже."}
      </p>
    );
  }
  if (!warehouses.length) return <p className="text-sm text-foreground/50">В 1С нет ни одного склада.</p>;
  redirect(`/admin/warehouse/${warehouses[0].ref}`);
}
