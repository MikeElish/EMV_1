import { requireSection } from "@/lib/access-server";
import { parsePeriod } from "@/lib/period";
import { fundBalances, fundMoves, monthFunds } from "@/lib/funds";
import { FundsView } from "@/components/admin/FundsView";

export default async function FinanceFundsPage({ searchParams }: PageProps<"/admin/finance/funds">) {
  await requireSection("finance.funds");
  const period = parsePeriod(await searchParams, ["month"]);
  const month = period.from.slice(0, 7);
  const data = await monthFunds(month);
  const [moves, balances] = await Promise.all([fundMoves(month, data), fundBalances(month)]);
  return <FundsView period={period} data={data} balances={balances} moves={moves} />;
}
