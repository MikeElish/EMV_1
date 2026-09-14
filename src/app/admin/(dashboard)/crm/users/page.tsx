import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { UsersTable } from "@/components/admin/UsersTable";

export default async function CrmUsersPage() {
  // passwordHash is deliberately not selected -- it would otherwise leak
  // into the page's RSC payload just by being passed as a client-component
  // prop, even though the table itself never renders it.
  const users = await prisma.user.findMany({
    select: {
      id: true,
      lastName: true,
      firstName: true,
      patronymic: true,
      login: true,
      email: true,
      phone: true,
      role: true,
      company: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <div className="flex items-center gap-3">
        <Link
          href="/admin/crm/users/new"
          aria-label="Добавить пользователя"
          className="flex h-8 w-8 items-center justify-center rounded-md bg-green-600 text-lg font-bold leading-none text-white transition-opacity hover:opacity-90"
        >
          +
        </Link>
        <h1 className="text-lg font-semibold">Пользователи</h1>
      </div>

      <div className="mt-4 overflow-x-auto">
        <UsersTable users={users} />
      </div>
    </div>
  );
}
