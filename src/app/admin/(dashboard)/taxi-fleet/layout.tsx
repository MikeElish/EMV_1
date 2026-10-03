import { NavTabs } from "@/components/admin/NavTabs";

const TABS = [
  { href: "/admin/taxi-fleet/driver-applications", label: "Заявки водителей" },
  { href: "/admin/taxi-fleet/tech", label: "Техника" },
  { href: "/admin/taxi-fleet/dispatch", label: "Диспетчерская" },
  { href: "/admin/taxi-fleet/glonass", label: "ГЛОНАСС" },
  { href: "/admin/taxi-fleet/repair", label: "Ремонт" },
];

export default function TaxiFleetLayout({ children }: { children: React.ReactNode }) {
  return <NavTabs tabs={TABS}>{children}</NavTabs>;
}
