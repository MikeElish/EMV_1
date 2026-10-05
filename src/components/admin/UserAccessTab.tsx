"use client";

import { useState, useTransition } from "react";
import { resetUserAccess, saveUserAccess } from "@/actions/crm/users";
import { sameAccess, type AccessLevel, type AccessMap } from "@/lib/access";
import { AccessLevelsTable } from "@/components/admin/AccessLevelsTable";

/** Карточка пользователя → Доступ: each admin section -- Редактирование / Просмотр / Скрыть. */
export function UserAccessTab({
  userId,
  isOwner,
  initial,
  template,
  personal,
  canEdit,
  onSaved,
}: {
  userId: string;
  /** The owner always has everything. */
  isOwner: boolean;
  initial: AccessMap;
  /** The role template (Настройки → Доступ). */
  template: AccessMap;
  /** Set apart from the template in this card. */
  personal: boolean;
  /** Only the owner hands out access. */
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [levels, setLevels] = useState<AccessMap>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  if (isOwner) {
    return <p className="mt-6 text-sm text-foreground/60">Владелец — полный доступ ко всем разделам.</p>;
  }

  function set(keys: string[], level: AccessLevel) {
    setSaved(false);
    setLevels((prev) => ({ ...prev, ...Object.fromEntries(keys.map((k) => [k, level])) }));
  }

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error);
      else {
        after?.();
        setSaved(true);
        onSaved();
      }
    });
  }

  const byTemplate = sameAccess(levels, template);

  return (
    <div className="mt-4">
      <p className="mb-2 text-sm text-foreground/60">
        {personal && !byTemplate
          ? "Индивидуальные права — отличаются от шаблона роли. При сохранении шаблона в «Настройки → Доступ» заменятся на него."
          : "Доступ по шаблону роли (Настройки → Доступ)."}
      </p>
      {!canEdit && <p className="mb-3 text-sm text-foreground/50">Доступ настраивает только владелец.</p>}
      <AccessLevelsTable levels={levels} onChange={set} disabled={!canEdit || pending} />
      {canEdit && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => run(() => saveUserAccess(userId, levels))}
            disabled={pending}
            className="rounded-md bg-foreground px-5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Сохраняем..." : "Сохранить"}
          </button>
          {!byTemplate && (
            <button
              type="button"
              onClick={() => run(() => resetUserAccess(userId), () => setLevels(template))}
              disabled={pending}
              className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium hover:bg-foreground/5 disabled:opacity-50"
            >
              По шаблону роли
            </button>
          )}
          {saved && <span className="text-sm text-green-600">Сохранено</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      )}
    </div>
  );
}
