import { NavTabs } from "@/components/admin/NavTabs";
import { requireSection } from "@/lib/access-server";
import { OneCError } from "@/lib/onec";
import { getWarehouseData } from "@/lib/onec-warehouse";

// Склад: one tab per warehouse of 1С.
export default async function WarehouseLayout({ children }: { children: React.ReactNode }) {
  await requireSection("warehouse");
  let warehouses: Awaited<ReturnType<typeof getWarehouseData>>["warehouses"] = [];
  try {
    ({ warehouses } = await getWarehouseData());
  } catch (error) {
    // The site-side journals below remain available when 1С is offline.
    console.error(
      "[warehouse-layout] failed to load 1С warehouses",
      error instanceof OneCError ? error.message : error
    );
  }
  return (
    <NavTabs
      fill
      tabs={[
        ...warehouses.map((w) => ({ href: `/admin/warehouse/${w.ref}`, label: w.name })),
        { href: "/admin/warehouse/receipts", label: "Поступление" },
        { href: "/admin/warehouse/handover", label: "Выдача" },
        { href: "/admin/warehouse/adjustments", label: "Списание/Оприходование" },
        { href: "/admin/warehouse/replenishment", label: "Пополнение остатков" },
      ]}
    >
      {children}
    </NavTabs>
  );
}
