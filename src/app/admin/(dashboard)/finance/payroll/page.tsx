import { requireSection } from "@/lib/access-server";
import { parsePeriod } from "@/lib/period";
import { payrollOf } from "@/lib/payroll";
import { PayrollView } from "@/components/admin/PayrollView";

export default async function FinancePayrollPage({ searchParams }: PageProps<"/admin/finance/payroll">) {
  await requireSection("finance.payroll");
  const period = parsePeriod(await searchParams, ["month"]);
  const month = period.from.slice(0, 7);
  return <PayrollView period={period} month={month} lines={await payrollOf(month)} />;
}
