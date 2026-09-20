"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import { ROLE_LABELS } from "@/lib/validators/crm";
import type { UserInput } from "@/lib/validators/crm";
import { updateUser, deleteUser } from "@/actions/crm/users";
import { UserForm } from "@/components/admin/UserForm";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { Modal } from "@/components/Modal";

type Row = {
  id: string;
  lastName: string | null;
  firstName: string | null;
  patronymic: string | null;
  login: string;
  email: string | null;
  phone: string | null;
  role: Role;
  companyId: string | null;
  company: { name: string } | null;
};

type Company = { id: string; name: string };

export function UsersTable({ users, companies }: { users: Row[]; companies: Company[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Row | null>(null);

  if (users.length === 0) {
    return <p className="text-sm text-foreground/40">Пользователей пока нет.</p>;
  }

  function close() {
    setSelected(null);
    router.refresh();
  }

  return (
    <>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-foreground/10 text-left text-foreground/50">
            <th className="py-2 pr-4">Фамилия</th>
            <th className="py-2 pr-4">Имя</th>
            <th className="py-2 pr-4">Отчество</th>
            <th className="py-2 pr-4">Логин</th>
            <th className="py-2 pr-4">Пароль</th>
            <th className="py-2 pr-4">Почта</th>
            <th className="py-2 pr-4">Телефон</th>
            <th className="py-2 pr-4">Компания</th>
            <th className="py-2 pr-4">Роль</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr
              key={user.id}
              onClick={() => setSelected(user)}
              className="cursor-pointer border-b border-foreground/10 hover:bg-foreground/5"
            >
              <td className="py-2 pr-4">{user.lastName ?? "—"}</td>
              <td className="py-2 pr-4">{user.firstName ?? "—"}</td>
              <td className="py-2 pr-4">{user.patronymic ?? "—"}</td>
              <td className="py-2 pr-4">{user.login}</td>
              <td className="py-2 pr-4 text-foreground/40">••••••••</td>
              <td className="py-2 pr-4">{user.email ?? "—"}</td>
              <td className="py-2 pr-4">{user.phone ?? "—"}</td>
              <td className="py-2 pr-4">{user.company?.name ?? "—"}</td>
              <td className="py-2 pr-4">{ROLE_LABELS[user.role] ?? user.role}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {selected && (
        <Modal onClose={() => setSelected(null)} maxWidthClassName="max-w-2xl">
          <h2 className="text-xl font-bold">Пользователь: {selected.login}</h2>
          <UserForm
            companies={companies}
            initial={{
              lastName: selected.lastName ?? undefined,
              firstName: selected.firstName ?? undefined,
              patronymic: selected.patronymic ?? undefined,
              email: selected.email ?? undefined,
              phone: selected.phone ?? undefined,
              role: (selected.role === "OWNER" ? "ADMIN" : selected.role) as UserInput["role"],
              companyId: selected.companyId ?? undefined,
            }}
            isOwner={selected.role === "OWNER"}
            onSubmit={(input) => updateUser(selected.id, input)}
            onSuccess={close}
          />

          {selected.role !== "OWNER" && (
            <div className="mt-6 flex justify-end">
              <DeleteButton
                action={async () => {
                  const result = await deleteUser(selected.id);
                  if (result.ok) close();
                  return result;
                }}
                confirmText={`Удалить пользователя «${selected.login}»?`}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              />
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
