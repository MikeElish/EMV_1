import { NavTabs } from "@/components/admin/NavTabs";

const TABS = [{ href: "/admin/finance/payment-requests", label: "Заявки на оплату" }];

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <NavTabs tabs={TABS} fill>
      {children}
    </NavTabs>
  );
}
