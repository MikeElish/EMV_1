import { NavTabs } from "@/components/admin/NavTabs";

const TABS = [
  { href: "/admin/reports/funds", label: "Фонды" },
  { href: "/admin/reports/salary", label: "Зарплата" },
  { href: "/admin/reports/execution", label: "Выполнение" },
  { href: "/admin/reports/analytics", label: "Аналитика" },
];

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return <NavTabs tabs={TABS}>{children}</NavTabs>;
}
