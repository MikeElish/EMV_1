import { NavTabs } from "@/components/admin/NavTabs";

const TABS = [
  { href: "/admin/crm/users", label: "Пользователи" },
  { href: "/admin/crm/companies", label: "Компании" },
  { href: "/admin/crm/orders", label: "Заказы" },
  { href: "/admin/crm/products", label: "Товары" },
  { href: "/admin/crm/services", label: "Услуги" },
  { href: "/admin/crm/categories", label: "Категории" },
  { href: "/admin/crm/search", label: "Поиск" },
  { href: "/admin/crm/price-check", label: "Проценка" },
  { href: "/admin/crm/supplier-orders", label: "Заказ поставщику" },
  { href: "/admin/crm/extra-costs", label: "Доп.расходы" },
];

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return <NavTabs tabs={TABS} fill>{children}</NavTabs>;
}
