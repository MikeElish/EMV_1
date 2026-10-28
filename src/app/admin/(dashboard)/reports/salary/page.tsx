import { redirect } from "next/navigation";

/** «Зарплата» of Отчёты is «Бонусы» now (the payroll is Финансы → Зарплата). */
export default function OldSalaryReportPage() {
  redirect("/admin/reports/bonuses");
}
