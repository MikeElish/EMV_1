"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/actions/admin/auth";

export function CrmLoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const result = await login({
      identifier: String(formData.get("identifier") ?? ""),
      password: String(formData.get("password") ?? ""),
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    router.push(result.role === "OWNER" ? "/admin" : "/crm/cabinet");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-xs flex-col gap-3">
      <input
        name="identifier"
        placeholder="Логин"
        required
        autoFocus
        className="w-full rounded-md border border-white/30 bg-white/5 px-4 py-2.5 text-center text-sm text-white outline-none placeholder:text-white/50 focus:border-white/60"
      />
      <input
        name="password"
        type="password"
        placeholder="Пароль"
        required
        className="w-full rounded-md border border-white/30 bg-white/5 px-4 py-2.5 text-center text-sm text-white outline-none placeholder:text-white/50 focus:border-white/60"
      />

      {error && <p className="text-center text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="mt-1 w-full rounded-md border border-white/30 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-50"
      >
        {submitting ? "Входим..." : "Войти"}
      </button>
    </form>
  );
}
