import { NavTabs } from "@/components/admin/NavTabs";

const TABS = [
  { href: "/admin/crm/users", label: "Пользователи" },
  { href: "/admin/crm/companies", label: "Компании" },
  { href: "/admin/crm/orders", label: "Заказы" },
  { href: "/admin/crm/products", label: "Товары" },
  { href: "/admin/crm/categories", label: "Категории" },
  { href: "/admin/crm/search", label: "Поиск" },
];

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return <NavTabs tabs={TABS}>{children}</NavTabs>;
}
