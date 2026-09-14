import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateUser, deleteUser } from "@/actions/crm/users";
import { UserForm } from "@/components/admin/UserForm";
import { DeleteButton } from "@/components/admin/DeleteButton";
import type { UserInput } from "@/lib/validators/crm";

export default async function EditUserPage({
  params,
}: PageProps<"/admin/crm/users/[id]">) {
  const { id } = await params;
  const [user, companies] = await Promise.all([
    prisma.user.findUnique({ where: { id } }),
    prisma.company.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!user) notFound();

  const isOwner = user.role === "OWNER";
  const initial: Partial<UserInput> = {
    lastName: user.lastName ?? undefined,
    firstName: user.firstName ?? undefined,
    patronymic: user.patronymic ?? undefined,
    email: user.email ?? undefined,
    phone: user.phone ?? undefined,
    role: (isOwner ? "ADMIN" : user.role) as UserInput["role"],
    companyId: user.companyId ?? undefined,
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">Пользователь: {user.login}</h1>
      <UserForm
        companies={companies}
        initial={initial}
        isOwner={isOwner}
        onSubmit={(input) => updateUser(id, input)}
      />

      {!isOwner && (
        <div className="mt-6 flex justify-end">
          <DeleteButton
            action={deleteUser.bind(null, id)}
            confirmText={`Удалить пользователя «${user.login}»?`}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          />
        </div>
      )}
    </div>
  );
}
