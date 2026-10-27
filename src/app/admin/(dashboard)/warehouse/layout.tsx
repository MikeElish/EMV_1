import { NavTabs } from "@/components/admin/NavTabs";
import { requireSection } from "@/lib/access-server";
import { OneCError } from "@/lib/onec";
import { getWarehouseData } from "@/lib/onec-warehouse";

// Склад: one tab per warehouse of 1С.
export default async function WarehouseLayout({ children }: { children: React.ReactNode }) {
  await requireSection("warehouse");
  let warehouses;
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
  return (
    <NavTabs fill tabs={warehouses.map((w) => ({ href: `/admin/warehouse/${w.ref}`, label: w.name }))}>
      {children}
    </NavTabs>
  );
}
