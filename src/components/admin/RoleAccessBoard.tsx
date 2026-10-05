"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import { saveRoleAccess } from "@/actions/admin/access";
import { sameAccess, type AccessLevel, type AccessMap } from "@/lib/access";
import { AccessLevelsTable } from "@/components/admin/AccessLevelsTable";
import { Modal } from "@/components/Modal";

export type RoleTemplate = {
  role: Role;
  label: string;
  access: AccessMap;
  /** Users with this role. */
  users: number;
  /** …of them with personal rights from their cards. */
  personal: number;
};

/** Leaving with unsaved changes: to another role, or to another page. */
type Leave = { kind: "role"; role: Role } | { kind: "href"; href: string };

/** Настройки → Доступ: the access template of each role. */
export function RoleAccessBoard({ templates, canEdit }: { templates: RoleTemplate[]; canEdit: boolean }) {
  const router = useRouter();
  const [saved, setSaved] = useState<Record<string, AccessMap>>(() =>
    Object.fromEntries(templates.map((t) => [t.role, t.access]))
  );
  const [role, setRole] = useState<Role>(templates[0].role);
  const [draft, setDraft] = useState<AccessMap>(templates[0].access);
  const [leaving, setLeaving] = useState<Leave | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const current = templates.find((t) => t.role === role)!;
  const dirty = !sameAccess(draft, saved[role]);

  // Links (menu, tabs) and closing the tab ask first while there are changes.
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  });
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!dirtyRef.current || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || url.pathname + url.search === location.pathname + location.search) return;
      event.preventDefault();
      event.stopPropagation();
      setLeaving({ kind: "href", href: url.pathname + url.search + url.hash });
    }
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (dirtyRef.current) event.preventDefault();
    }
    document.addEventListener("click", onClick, true);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  function go(to: Leave) {
    setLeaving(null);
    setError(null);
    setMessage(null);
    if (to.kind === "href") router.push(to.href);
    else {
      setRole(to.role);
      setDraft(saved[to.role]);
    }
  }

  function chooseRole(next: Role) {
    if (next === role) return;
    if (dirty) setLeaving({ kind: "role", role: next });
    else go({ kind: "role", role: next });
  }

  function change(keys: string[], level: AccessLevel) {
    setMessage(null);
    setDraft((prev) => ({ ...prev, ...Object.fromEntries(keys.map((k) => [k, level])) }));
  }

  function save(then?: Leave) {
    setError(null);
    startTransition(async () => {
      const result = await saveRoleAccess(role, draft);
      if (!result.ok) {
        setError(result.error);
        setLeaving(null);
        return;
      }
      setSaved((prev) => ({ ...prev, [role]: draft }));
      if (then) go(then);
      else {
        setMessage(`Шаблон сохранён и применён: пользователей с этой ролью — ${result.users}.`);
        router.refresh();
      }
    });
  }

  function discard(then?: Leave) {
    setDraft(saved[role]);
    if (then) go(then);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-semibold">Доступ по ролям</h1>
      <p className="mt-1 text-sm text-foreground/50">
        Шаблон применяется ко всем пользователям роли. Индивидуальные права из карточек пользователей при сохранении
        шаблона заменяются на него.
      </p>

      <label className="mt-5 flex items-center gap-3 text-sm">
        <span className="font-medium">Роль</span>
        <select
          value={role}
          onChange={(e) => chooseRole(e.target.value as Role)}
          aria-label="Роль"
          className="rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm outline-none focus:border-foreground/50"
        >
          {templates.map((t) => (
            <option key={t.role} value={t.role}>
              {t.label}
            </option>
          ))}
        </select>
        <span className="text-foreground/50">
          пользователей: {current.users}
          {current.personal > 0 && `, с индивидуальными правами: ${current.personal}`}
        </span>
      </label>

      {!canEdit && <p className="mt-3 text-sm text-foreground/50">Шаблоны доступа настраивает только владелец.</p>}
      <div className="mt-2">
        <AccessLevelsTable levels={draft} onChange={change} disabled={!canEdit || pending} />
      </div>

      <div className="mt-5 flex min-h-10 flex-wrap items-center gap-3">
        {canEdit && dirty && (
          <>
            <button
              type="button"
              onClick={() => save()}
              disabled={pending}
              className="rounded-md bg-foreground px-5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Сохраняем..." : "Сохранить"}
            </button>
            <button
              type="button"
              onClick={() => discard()}
              disabled={pending}
              className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium hover:bg-foreground/5 disabled:opacity-50"
            >
              Отменить изменения
            </button>
          </>
        )}
        {message && <span className="text-sm text-green-600">{message}</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>

      {leaving && (
        <Modal onClose={() => setLeaving(null)} maxWidthClassName="max-w-sm">
          <h2 className="text-lg font-semibold">Изменения не сохранены</h2>
          <p className="mt-2 text-sm text-foreground/70">
            Шаблон доступа роли «{current.label}» изменён. Сохранить изменения?
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => save(leaving)}
              disabled={pending}
              className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Сохраняем..." : "Сохранить"}
            </button>
            <button
              type="button"
              onClick={() => discard(leaving)}
              disabled={pending}
              className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium hover:bg-foreground/5 disabled:opacity-50"
            >
              Отменить изменения
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
