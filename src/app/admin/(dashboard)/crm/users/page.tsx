import { prisma } from "@/lib/prisma";
import { getMyAccess } from "@/lib/access-server";
import { resolveAccess } from "@/lib/access";
import { CrmPage } from "@/components/admin/CrmTableFrame";
import { UsersTable } from "@/components/admin/UsersTable";

export default async function CrmUsersPage() {
  // passwordHash is deliberately not selected -- it would otherwise leak
  // into the page's RSC payload just by being passed as a client-component
  // prop, even though the table itself never renders it.
  const [users, companies, me, templates] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        lastName: true,
        firstName: true,
        patronymic: true,
        login: true,
        email: true,
        phone: true,
        role: true,
        companyId: true,
        company: { select: { name: true } },
        access: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.company.findMany({ orderBy: { name: "asc" } }),
    getMyAccess(),
    prisma.roleAccess.findMany(),
  ]);
  const templateOf = new Map(templates.map((t) => [t.role, t.access]));

  return (
    <CrmPage>
      <UsersTable
        users={users.map(({ access, ...u }) => ({
          ...u,
          access: resolveAccess(u.role, access, templateOf.get(u.role)),
          template: resolveAccess(u.role, null, templateOf.get(u.role)),
          personalAccess: access !== null,
        }))}
        companies={companies}
        canEditAccess={me?.role === "OWNER"}
      />
    </CrmPage>
  );
}
