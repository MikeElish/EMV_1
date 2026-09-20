import { redirect } from "next/navigation";

export default function TaxiFleetIndexPage() {
  redirect("/admin/taxi-fleet/driver-applications");
}
