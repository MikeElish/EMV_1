import { prisma } from "@/lib/prisma";
import { BrandsTable } from "@/components/admin/BrandsTable";

export default async function AdminBrandsPage() {
  const [brands, stats] = await Promise.all([
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
    prisma.product.groupBy({
      by: ["brand"],
      where: { brand: { not: null } },
      _count: { id: true },
      _sum: { stock: true },
    }),
  ]);

  const statsByBrand = new Map(
    stats.map((s) => [
      s.brand ?? "",
      { productCount: s._count.id, inStockCount: s._sum.stock ?? 0 },
    ])
  );

  const rows = brands.map((brand) => ({
    ...brand,
    productCount: statsByBrand.get(brand.name)?.productCount ?? 0,
    inStockCount: statsByBrand.get(brand.name)?.inStockCount ?? 0,
  }));

  return <BrandsTable brands={rows} />;
}
