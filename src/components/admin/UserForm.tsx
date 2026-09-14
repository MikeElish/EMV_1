"use client";

import { useState, type FormEvent } from "react";
import type { UserInput } from "@/lib/validators/crm";
import { ASSIGNABLE_ROLES, ROLE_LABELS } from "@/lib/validators/crm";
import type { ActionResult } from "@/actions/crm/users";

type Company = { id: string; name: string };

export function UserForm({
  companies,
  initial,
  isOwner,
  onSubmit,
}: {
  companies: Company[];
  initial?: Partial<UserInput>;
  isOwner?: boolean;
  onSubmit: (input: UserInput) => Promise<ActionResult>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const result = await onSubmit({
      lastName: String(formData.get("lastName") ?? "") || undefined,
      firstName: String(formData.get("firstName") ?? "") || undefined,
      patronymic: String(formData.get("patronymic") ?? "") || undefined,
      email: String(formData.get("email") ?? "") || undefined,
      phone: String(formData.get("phone") ?? "") || undefined,
      role: (String(formData.get("role") ?? "") || "MANAGER") as UserInput["role"],
      companyId: String(formData.get("companyId") ?? "") || undefined,
      password: String(formData.get("password") ?? "") || undefined,
    });

    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 max-w-xl space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label htmlFor="lastName" className="text-sm text-foreground/60">
            Фамилия
          </label>
          <input
            id="lastName"
            name="lastName"
            defaultValue={initial?.lastName}
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
          />
        </div>
        <div>
          <label htmlFor="firstName" className="text-sm text-foreground/60">
            Имя
          </label>
          <input
            id="firstName"
            name="firstName"
            defaultValue={initial?.firstName}
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
          />
        </div>
        <div>
          <label htmlFor="patronymic" className="text-sm text-foreground/60">
            Отчество
          </label>
          <input
            id="patronymic"
            name="patronymic"
            defaultValue={initial?.patronymic}
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="email" className="text-sm text-foreground/60">
            Почта
          </label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={initial?.email}
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
          />
        </div>
        <div>
          <label htmlFor="phone" className="text-sm text-foreground/60">
            Телефон
          </label>
          <input
            id="phone"
            name="phone"
            defaultValue={initial?.phone}
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="role" className="text-sm text-foreground/60">
            Роль
          </label>
          {isOwner ? (
            <input
              disabled
              value={ROLE_LABELS.OWNER}
              className="mt-1 w-full rounded-md border border-foreground/10 bg-foreground/5 px-3 py-2 text-foreground/50 outline-none"
            />
          ) : (
            <select
              id="role"
              name="role"
              required
              defaultValue={initial?.role ?? "MANAGER"}
              className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
            >
              {ASSIGNABLE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label htmlFor="companyId" className="text-sm text-foreground/60">
            Компания
          </label>
          <select
            id="companyId"
            name="companyId"
            defaultValue={initial?.companyId ?? ""}
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
          >
            <option value="">— без компании —</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="password" className="text-sm text-foreground/60">
          {initial ? "Новый пароль (оставьте пустым, чтобы не менять)" : "Пароль"}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required={!initial}
          className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-foreground px-6 py-2 font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Сохраняем..." : "Сохранить"}
      </button>
    </form>
  );
}
