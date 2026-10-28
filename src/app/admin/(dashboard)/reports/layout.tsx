import { NavTabs } from "@/components/admin/NavTabs";

const TABS = [
  { href: "/admin/reports/funds", label: "Фонды" },
  { href: "/admin/reports/bonuses", label: "Бонусы" },
  { href: "/admin/reports/execution", label: "Выполнение" },
  { href: "/admin/reports/analytics", label: "Аналитика" },
  { href: "/admin/reports/movements", label: "Движение товаров" },
];

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <NavTabs tabs={TABS} fill>
      {children}
    </NavTabs>
  );
}
