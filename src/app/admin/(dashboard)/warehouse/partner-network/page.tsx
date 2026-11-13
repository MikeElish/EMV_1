import { getMyAccess } from "@/lib/access-server";
import { getSuppliers, listPartnerStocks } from "@/actions/admin/partner-network";
import { PartnerNetworkTable } from "@/components/admin/PartnerNetworkTable";

export const dynamic = "force-dynamic";

export default async function PartnerNetworkPage() {
  const [stocks, suppliers, me] = await Promise.all([
    listPartnerStocks(),
    getSuppliers(),
    getMyAccess(),
  ]);
  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-semibold">Партнёрская сеть</h1>
      <PartnerNetworkTable initialStocks={stocks} suppliers={suppliers} canEdit={me?.role === "OWNER" || false} />
    </div>
  );
}
