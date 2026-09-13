"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { setupFirstAdmin } from "@/actions/admin/auth";

export function SetupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const result = await setupFirstAdmin({
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <div>
        <label htmlFor="email" className="text-sm text-foreground/60">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoFocus
          className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
        />
      </div>
      <div>
        <label htmlFor="password" className="text-sm text-foreground/60">
          Пароль (минимум 8 символов)
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-foreground px-6 py-2 font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Создаём..." : "Создать администратора"}
      </button>
    </form>
  );
}
