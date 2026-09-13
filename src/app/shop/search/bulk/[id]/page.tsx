import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { matchRows, type BulkSearchRow } from "@/lib/bulk-search-match";
import { BulkSearchResultsTable } from "@/components/shop/BulkSearchResultsTable";

export default async function BulkSearchResultPage({
  params,
}: PageProps<"/shop/search/bulk/[id]">) {
  const { id } = await params;
  const request = await prisma.bulkSearchRequest.findUnique({ where: { id } });
  if (!request) notFound();

  // Re-resolved against the current product table on every view (rather than
  // stored once at upload time) so stock/matches stay accurate even if the
  // catalog changes between the upload and someone viewing the results.
  const rows = request.rows as unknown as BulkSearchRow[];
  const products = await prisma.product.findMany({ where: { isActive: true } });
  const matched = matchRows(rows, products);

  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <BulkSearchResultsTable rows={matched} />
    </section>
  );
}
