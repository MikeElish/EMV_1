import { requireSection } from "@/lib/access-server";
import { CrmPage } from "@/components/admin/CrmTableFrame";
import { LogisticsTable } from "@/components/admin/LogisticsTable";
import { getLogisticsRequests } from "@/actions/admin/logistics";

export default async function TaxiFleetLogisticsPage() {
  await requireSection("taxi.logistics", "view");
  const result = await getLogisticsRequests();
  if (!result.ok) {
    return (
      <CrmPage>
        <p className="text-sm text-red-600">{result.error}</p>
      </CrmPage>
    );
  }
  return (
    <CrmPage>
      <LogisticsTable requests={result.requests} />
    </CrmPage>
  );
}
