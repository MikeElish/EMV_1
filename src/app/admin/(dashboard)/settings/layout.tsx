import { NavTabs } from "@/components/admin/NavTabs";

const TABS = [
  { href: "/admin/settings/site", label: "Сайт" },
  { href: "/admin/settings/mail", label: "Почта" },
  { href: "/admin/settings/prices", label: "Цены" },
  { href: "/admin/settings/glonass", label: "ГЛОНАСС" },
  { href: "/admin/settings/yandex-fleet", label: "Яндекс.Флот" },
  { href: "/admin/settings/1c", label: "1С" },
  { href: "/admin/settings/access", label: "Доступ" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <NavTabs tabs={TABS}>{children}</NavTabs>;
}
