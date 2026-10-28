import { prisma } from "@/lib/prisma";
import { requireSection } from "@/lib/access-server";
import { parsePeriod } from "@/lib/period";
import { salaryReport } from "@/lib/salary-report";
import { planOf } from "@/lib/payroll";
import { ExecutionChart } from "@/components/admin/ExecutionChart";

export default async function ReportsExecutionPage({ searchParams }: PageProps<"/admin/reports/execution">) {
  await requireSection("reports.execution");
  const sp = await searchParams;
  const period = parsePeriod(sp, ["month", "year"]);
  const staff = await prisma.user.findMany({
    where: { role: { notIn: ["CUSTOMER", "DRIVER"] } },
    select: { id: true, lastName: true, firstName: true, login: true, salary: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  const employees = staff.map((u) => ({ id: u.id, name: [u.lastName, u.firstName].filter(Boolean).join(" ") || u.login }));
  const pickE = typeof sp.e === "string" ? sp.e : "";
  const employee = staff.find((u) => u.id === pickE);

  let points: { x: string; y: number }[] = [];
  let plan = 0;
  if (employee) {
    const report = await salaryReport(employee.id, period.from, period.to);
    const byKey = new Map<string, number>();
    const yearly = period.mode === "year";
    for (const r of report.rows) {
      const key = yearly ? r.date.slice(0, 7) : r.date;
      byKey.set(key, (byKey.get(key) ?? 0) + r.total);
    }
    // Every day of the month (every month of the year) up to today, cumulative.
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Moscow" });
    let sum = 0;
    if (yearly) {
      for (let m = 1; m <= 12; m++) {
        const key = `${period.y}-${String(m).padStart(2, "0")}`;
        if (`${key}-01` > today) break;
        sum += byKey.get(key) ?? 0;
        points.push({ x: key, y: sum });
      }
      plan = planOf(employee.salary ?? 0) * 12;
    } else {
      const last = Number(period.to.slice(8, 10));
      for (let d = 1; d <= last; d++) {
        const key = `${period.from.slice(0, 8)}${String(d).padStart(2, "0")}`;
        if (key > today) break;
        sum += byKey.get(key) ?? 0;
        points.push({ x: key, y: sum });
      }
      plan = planOf(employee.salary ?? 0);
    }
  } else points = [];

  return <ExecutionChart period={period} employees={employees} employeeId={employee?.id ?? ""} points={points} plan={plan} />;
}
