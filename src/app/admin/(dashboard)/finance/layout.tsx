import { NavTabs } from "@/components/admin/NavTabs";

const TABS = [
  { href: "/admin/finance/payment-requests", label: "Заявки на оплату" },
  { href: "/admin/finance/summary", label: "Сводный отчёт" },
  { href: "/admin/finance/funds", label: "Фонды" },
  { href: "/admin/finance/payroll", label: "Зарплата" },
  { href: "/admin/finance/taxes", label: "Налоги" },
];

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <NavTabs tabs={TABS} fill>
      {children}
    </NavTabs>
  );
}
