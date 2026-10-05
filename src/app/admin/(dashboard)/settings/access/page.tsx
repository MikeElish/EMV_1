import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMyAccess } from "@/lib/access-server";
import { isConfigurableRole, resolveAccess } from "@/lib/access";
import { ROLE_LABELS } from "@/lib/validators/crm";
import { RoleAccessBoard } from "@/components/admin/RoleAccessBoard";

// Настройки → Доступ: access templates of the employee roles.
export default async function AccessSettingsPage() {
  const [templates, users, me] = await Promise.all([
    prisma.roleAccess.findMany(),
    prisma.user.groupBy({ by: ["role"], _count: true }),
    getMyAccess(),
  ]);
  const personal = await prisma.user.groupBy({ by: ["role"], where: { access: { not: Prisma.DbNull } }, _count: true });
  const templateOf = new Map(templates.map((t) => [t.role, t.access]));
  const usersOf = new Map(users.map((u) => [u.role, u._count]));
  const personalOf = new Map(personal.map((u) => [u.role, u._count]));

  return (
    <RoleAccessBoard
      canEdit={me?.role === "OWNER"}
      templates={Object.values(Role)
        .filter(isConfigurableRole)
        .map((role) => ({
          role,
          label: ROLE_LABELS[role] ?? role,
          access: resolveAccess(role, null, templateOf.get(role)),
          users: usersOf.get(role) ?? 0,
          personal: personalOf.get(role) ?? 0,
        }))}
    />
  );
}
