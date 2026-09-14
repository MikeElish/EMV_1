import { prisma } from "@/lib/prisma";
import { createUser } from "@/actions/crm/users";
import { UserForm } from "@/components/admin/UserForm";

export default async function NewUserPage() {
  const companies = await prisma.company.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <h1 className="text-2xl font-bold">Новый пользователь</h1>
      <UserForm companies={companies} onSubmit={createUser} />
    </div>
  );
}
