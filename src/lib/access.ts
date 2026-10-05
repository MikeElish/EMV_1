import type { Role } from "@prisma/client";

// Карточка пользователя → Доступ: every section of the admin with its own
// level. Shared by the proxy (pages), the server actions and the UI (menus,
// «только просмотр» banner).

export type AccessLevel = "edit" | "view" | "hide";
export const ACCESS_LEVEL_LABELS: Record<AccessLevel, string> = {
  edit: "Редактирование",
  view: "Просмотр",
  hide: "Скрыть",
};
const RANK: Record<AccessLevel, number> = { hide: 0, view: 1, edit: 2 };

export type AccessSection = { key: string; label: string; path: string };
export type AccessGroup = { label: string; path: string; sections: AccessSection[] };

export const ACCESS_GROUPS: AccessGroup[] = [
  { label: "Дашборд", path: "/admin", sections: [{ key: "dashboard", label: "Дашборд", path: "/admin" }] },
  {
    label: "CRM",
    path: "/admin/crm",
    sections: [
      { key: "crm.users", label: "Пользователи", path: "/admin/crm/users" },
      { key: "crm.companies", label: "Компании", path: "/admin/crm/companies" },
      { key: "crm.orders", label: "Заказы", path: "/admin/crm/orders" },
      { key: "crm.products", label: "Товары", path: "/admin/crm/products" },
      { key: "crm.services", label: "Услуги", path: "/admin/crm/services" },
      { key: "crm.categories", label: "Категории", path: "/admin/crm/categories" },
      { key: "crm.search", label: "Поиск", path: "/admin/crm/search" },
      { key: "crm.price-check", label: "Проценка", path: "/admin/crm/price-check" },
      { key: "crm.supplier-orders", label: "Заказ поставщику", path: "/admin/crm/supplier-orders" },
      { key: "crm.extra-costs", label: "Доп.расходы", path: "/admin/crm/extra-costs" },
    ],
  },
  {
    label: "Таксопарк",
    path: "/admin/taxi-fleet",
    sections: [
      { key: "taxi.driver-applications", label: "Заявки водителей", path: "/admin/taxi-fleet/driver-applications" },
      { key: "taxi.tech", label: "Техника", path: "/admin/taxi-fleet/tech" },
      { key: "taxi.dispatch", label: "Диспетчерская", path: "/admin/taxi-fleet/dispatch" },
      { key: "taxi.glonass", label: "ГЛОНАСС", path: "/admin/taxi-fleet/glonass" },
      { key: "taxi.fuel", label: "Заправки", path: "/admin/taxi-fleet/fuel" },
      { key: "taxi.repair", label: "Ремонт", path: "/admin/taxi-fleet/repair" },
    ],
  },
  { label: "Отчёты", path: "/admin/reports", sections: [{ key: "reports", label: "Отчёты", path: "/admin/reports" }] },
  { label: "Почта", path: "/admin/mail", sections: [{ key: "mail", label: "Почта", path: "/admin/mail" }] },
  {
    label: "Настройки",
    path: "/admin/settings",
    sections: [
      { key: "settings.site", label: "Сайт", path: "/admin/settings/site" },
      { key: "settings.mail", label: "Почта", path: "/admin/settings/mail" },
      { key: "settings.prices", label: "Цены", path: "/admin/settings/prices" },
      { key: "settings.glonass", label: "ГЛОНАСС", path: "/admin/settings/glonass" },
      { key: "settings.yandex-fleet", label: "Яндекс.Флот", path: "/admin/settings/yandex-fleet" },
      { key: "settings.1c", label: "1С", path: "/admin/settings/1c" },
    ],
  },
];

export const ACCESS_SECTIONS: AccessSection[] = ACCESS_GROUPS.flatMap((g) => g.sections);
export type AccessMap = Record<string, AccessLevel>;

/** Before anything is set: Почта for every employee, the rest closed (as it was). */
export function defaultLevel(key: string): AccessLevel {
  return key === "mail" ? "edit" : "hide";
}

const isLevel = (v: unknown): v is AccessLevel => v === "edit" || v === "view" || v === "hide";

/** Every section's level for this user. The owner always has everything. */
export function resolveAccess(role: Role, stored: unknown): AccessMap {
  const saved = stored && typeof stored === "object" ? (stored as Record<string, unknown>) : {};
  return Object.fromEntries(
    ACCESS_SECTIONS.map((s) => {
      if (role === "OWNER") return [s.key, "edit"];
      if (role === "CUSTOMER") return [s.key, "hide"];
      const v = saved[s.key];
      return [s.key, isLevel(v) ? v : defaultLevel(s.key)];
    })
  );
}

export const atLeast = (level: AccessLevel, needed: AccessLevel) => RANK[level] >= RANK[needed];

/** The section a page belongs to (null: not an access-controlled page). */
export function sectionOfPath(pathname: string): AccessSection | null {
  if (pathname === "/admin" || pathname === "/admin/") return ACCESS_SECTIONS[0];
  if (pathname.startsWith("/admin/mail-attachment")) return ACCESS_SECTIONS.find((s) => s.key === "mail")!;
  let best: AccessSection | null = null;
  for (const s of ACCESS_SECTIONS) {
    if (s.path === "/admin") continue;
    if ((pathname === s.path || pathname.startsWith(s.path + "/")) && (!best || s.path.length > best.path.length)) best = s;
  }
  return best;
}

/** The group a path is the root of (/admin/crm → CRM), if any. */
export function groupOfRoot(pathname: string): AccessGroup | null {
  const p = pathname.replace(/\/$/, "");
  return ACCESS_GROUPS.find((g) => g.path === p && g.path !== "/admin" && g.sections.length > 1) ?? null;
}

/** Where a user lands: the first section they may see -- in `group`, or anywhere. */
export function firstVisible(access: AccessMap, group?: AccessGroup | null): string | null {
  const list = group ? group.sections : ACCESS_SECTIONS;
  return list.find((s) => access[s.key] !== "hide")?.path ?? null;
}
