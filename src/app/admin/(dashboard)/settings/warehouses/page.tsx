import { requireSection } from "@/lib/access-server";
import { OneCError } from "@/lib/onec";
import { WAREHOUSE_TYPES, listWarehouseCards } from "@/lib/onec-stock-docs";
import { WarehousesSettings } from "@/components/admin/WarehousesSettings";

export default async function WarehousesSettingsPage() {
  await requireSection("settings.warehouses");
  const warehouses = await listWarehouseCards().catch((error: unknown) =>
    error instanceof OneCError ? error.message : "1С не ответила — список складов недоступен, попробуйте позже."
  );
  if (typeof warehouses === "string") return <p className="text-sm text-red-600">{warehouses}</p>;
  return <WarehousesSettings warehouses={warehouses} types={WAREHOUSE_TYPES} />;
}
