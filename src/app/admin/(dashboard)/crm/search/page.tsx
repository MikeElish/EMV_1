import { prisma } from "@/lib/prisma";
import { CrmPage } from "@/components/admin/CrmTableFrame";
import { SearchLogTable } from "@/components/admin/SearchLogTable";

export default async function AdminSearchPage() {
  const logs = await prisma.searchLog.findMany({
    orderBy: [{ inSystem: "asc" }, { totalCount: "desc" }],
    include: { dailyCounts: { orderBy: { date: "desc" } } },
  });

  return (
    <CrmPage>
      <h1 className="text-2xl font-bold">Поиск</h1>
      <SearchLogTable logs={logs} />
    </CrmPage>
  );
}
