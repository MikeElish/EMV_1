import { prisma } from "@/lib/prisma";
import { SearchLogTable } from "@/components/admin/SearchLogTable";

export default async function AdminSearchPage({
  searchParams,
}: PageProps<"/admin/search">) {
  const query = await searchParams;
  const brand = typeof query.brand === "string" && query.brand ? query.brand : undefined;

  const [logs, brandRows] = await Promise.all([
    prisma.searchLog.findMany({
      where: brand ? { brand } : undefined,
      orderBy: [{ inSystem: "asc" }, { totalCount: "desc" }],
      include: { dailyCounts: { orderBy: { date: "desc" } } },
    }),
    prisma.searchLog.findMany({
      distinct: ["brand"],
      select: { brand: true },
      orderBy: { brand: "asc" },
    }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Поиск</h1>
      <SearchLogTable logs={logs} brands={brandRows.map((b) => b.brand)} selectedBrand={brand ?? ""} />
    </div>
  );
}
