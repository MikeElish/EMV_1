import { NavTabs } from "@/components/admin/NavTabs";

const TABS = [
  { href: "/admin/settings/site", label: "Сайт" },
  { href: "/admin/settings/mail", label: "Почта" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <NavTabs tabs={TABS}>{children}</NavTabs>;
}
