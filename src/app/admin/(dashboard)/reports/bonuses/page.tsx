import { prisma } from "@/lib/prisma";
import { requireSection } from "@/lib/access-server";
import { salaryReport } from "@/lib/salary-report";
import { SalaryReportView } from "@/components/admin/SalaryReportView";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The 1st of this month and today in Moscow, "YYYY-MM-DD". */
function defaultPeriod() {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Moscow" });
  return { from: `${today.slice(0, 8)}01`, to: today };
}

export default async function ReportsBonusesPage({ searchParams }: PageProps<"/admin/reports/bonuses">) {
  await requireSection("reports.salary");
  const sp = await searchParams;
  const pick = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const period = defaultPeriod();
  const from = DAY.test(pick("from")) ? pick("from") : period.from;
  const to = DAY.test(pick("to")) ? pick("to") : period.to;

  const staff = await prisma.user.findMany({
    where: { role: { notIn: ["CUSTOMER", "DRIVER"] } },
    select: { id: true, lastName: true, firstName: true, login: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  const employees = staff.map((u) => ({ id: u.id, name: [u.lastName, u.firstName].filter(Boolean).join(" ") || u.login }));
  const employeeId = employees.some((e) => e.id === pick("e")) ? pick("e") : "";

  return (
    <SalaryReportView
      employees={employees}
      employeeId={employeeId}
      from={from}
      to={to}
      report={employeeId ? await salaryReport(employeeId, from, to) : null}
    />
  );
}
