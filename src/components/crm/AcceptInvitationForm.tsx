"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { completeUserInvitation } from "@/actions/crm/invitations";

export function AcceptInvitationForm({
  token,
  invitation,
}: {
  token: string;
  invitation: { login: string; email: string | null } | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");
    if (password !== confirmation) {
      setError("Пароли не совпадают.");
      return;
    }

    setPending(true);
    const result = await completeUserInvitation(token, password);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.replace("/crm?invite=accepted");
    router.refresh();
  }

  if (!invitation) {
    return (
      <div className="w-full max-w-sm text-center text-sm text-white/80">
        <p>Ссылка приглашения истекла, недействительна или уже использована.</p>
        <p className="mt-2">Попросите владельца отправить новое приглашение.</p>
        <Link href="/crm" className="mt-5 inline-block underline underline-offset-4">
          Перейти ко входу
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-4 text-center text-sm text-white/75">
        <p>Логин: {invitation.login}</p>
        {invitation.email && <p className="mt-1">{invitation.email}</p>}
      </div>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          name="password"
          type="password"
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          required
          placeholder="Придумайте пароль (от 8 символов)"
          className="w-full rounded-md border border-white/30 bg-white/5 px-4 py-2.5 text-center text-sm text-white outline-none placeholder:text-white/50 focus:border-white/60"
        />
        <input
          name="confirmation"
          type="password"
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          required
          placeholder="Повторите пароль"
          className="w-full rounded-md border border-white/30 bg-white/5 px-4 py-2.5 text-center text-sm text-white outline-none placeholder:text-white/50 focus:border-white/60"
        />
        {error && <p className="text-center text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="mt-1 w-full rounded-md border border-white/30 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          {pending ? "Сохраняем..." : "Задать пароль"}
        </button>
      </form>
    </div>
  );
}
