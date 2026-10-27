import { redirect } from "next/navigation";
import { getWarehouseData } from "@/lib/onec-warehouse";

export default async function WarehouseIndexPage() {
  const { warehouses } = await getWarehouseData();
  redirect(`/admin/warehouse/${warehouses[0].ref}`);
}
