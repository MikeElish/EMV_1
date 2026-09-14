"use client";

import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import { ROLE_LABELS } from "@/lib/validators/crm";

type Row = {
  id: string;
  lastName: string | null;
  firstName: string | null;
  patronymic: string | null;
  login: string;
  email: string | null;
  phone: string | null;
  role: Role;
  company: { name: string } | null;
};

export function UsersTable({ users }: { users: Row[] }) {
  const router = useRouter();

  if (users.length === 0) {
    return <p className="text-sm text-foreground/40">Пользователей пока нет.</p>;
  }

  return (
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
            onClick={() => router.push(`/admin/crm/users/${user.id}`)}
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
  );
}
