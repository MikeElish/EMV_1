import { requireSection } from "@/lib/access-server";
import { parsePeriod } from "@/lib/period";
import { taxYear } from "@/lib/taxes";
import { TaxesView } from "@/components/admin/TaxesView";

export default async function FinanceTaxesPage({ searchParams }: PageProps<"/admin/finance/taxes">) {
  await requireSection("finance.taxes");
  const period = parsePeriod(await searchParams, ["year"]);
  const data = await taxYear(period.y);
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Moscow" });
  return <TaxesView period={period} data={data} today={today} />;
}
