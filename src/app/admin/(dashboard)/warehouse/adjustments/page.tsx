import { OneCError } from "@/lib/onec";
import { getWarehouseData } from "@/lib/onec-warehouse";
import { listAdjustments } from "@/lib/onec-stock-docs";
import { CrmPage } from "@/components/admin/CrmTableFrame";
import { AdjustmentsTable } from "@/components/admin/AdjustmentsTable";

async function load() {
  try {
    const [data, docs] = await Promise.all([getWarehouseData(), listAdjustments()]);
    return { ok: true as const, data, docs };
  } catch (error) {
    return { ok: false as const, error: error instanceof OneCError ? error.message : "1С не ответила — документы недоступны, попробуйте позже." };
  }
}

export default async function AdjustmentsPage() {
  const loaded = await load();
  if (!loaded.ok) return <p className="text-sm text-red-600">{loaded.error}</p>;
  const name = new Map(loaded.data.warehouses.map((w) => [w.ref, w.name]));
  return (
    <CrmPage>
      <AdjustmentsTable
        warehouses={loaded.data.warehouses}
        docs={loaded.docs.map((d) => ({ ...d, warehouse: name.get(d.warehouseRef) ?? "—" }))}
      />
    </CrmPage>
  );
}
