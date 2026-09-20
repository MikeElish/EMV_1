"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Role } from "@prisma/client";
import { ROLE_LABELS } from "@/lib/validators/crm";
import type { UserInput } from "@/lib/validators/crm";
import { updateUser, deleteUser } from "@/actions/crm/users";
import { UserForm } from "@/components/admin/UserForm";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { Modal } from "@/components/Modal";
import { TableSearchInput } from "@/components/admin/TableSearchInput";

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
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) =>
      [
        user.lastName,
        user.firstName,
        user.patronymic,
        user.login,
        user.email,
        user.phone,
        user.company?.name,
        ROLE_LABELS[user.role],
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [users, search]);

  function close() {
    setSelected(null);
    router.refresh();
  }

  return (
    <>
      <div className="flex items-center justify-between">
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
        <TableSearchInput value={search} onChange={setSearch} placeholder="Поиск по пользователям..." />
      </div>

      {users.length === 0 ? (
        <p className="mt-4 text-sm text-foreground/40">Пользователей пока нет.</p>
      ) : filtered.length === 0 ? (
        <p className="mt-4 text-sm text-foreground/40">Ничего не найдено.</p>
      ) : (
      <table className="mt-4 w-full text-sm">
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
          {filtered.map((user) => (
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
      )}

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
