"use client";

import { useState, useTransition } from "react";
import { saveUserAccess } from "@/actions/crm/users";
import { ACCESS_GROUPS, ACCESS_LEVEL_LABELS, type AccessLevel, type AccessMap } from "@/lib/access";

const LEVELS = Object.keys(ACCESS_LEVEL_LABELS) as AccessLevel[];
const selectClass =
  "rounded-md border border-foreground/20 bg-background px-2 py-1.5 text-sm outline-none focus:border-foreground/50 disabled:opacity-60";

/** Карточка пользователя → Доступ: each admin section -- Редактирование / Просмотр / Скрыть. */
export function UserAccessTab({
  userId,
  isOwner,
  initial,
  canEdit,
  onSaved,
}: {
  userId: string;
  /** The owner always has everything. */
  isOwner: boolean;
  initial: AccessMap;
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
  const disabled = !canEdit || pending;

  function set(keys: string[], level: AccessLevel) {
    setSaved(false);
    setLevels((prev) => ({ ...prev, ...Object.fromEntries(keys.map((k) => [k, level])) }));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveUserAccess(userId, levels);
      if (!result.ok) setError(result.error);
      else {
        setSaved(true);
        onSaved();
      }
    });
  }

  return (
    <div className="mt-4">
      {!canEdit && <p className="mb-3 text-sm text-foreground/50">Доступ настраивает только владелец.</p>}
      <table className="w-full text-sm">
        <tbody>
          {ACCESS_GROUPS.map((group) => {
            const keys = group.sections.map((s) => s.key);
            const same = keys.every((k) => levels[k] === levels[keys[0]]) ? levels[keys[0]] : "";
            return [
              <tr key={group.path} className="border-b border-foreground/10">
                <th className="pb-2 pt-4 pr-4 text-left font-semibold">{group.label}</th>
                <td className="pb-2 pt-4 text-right">
                  {group.sections.length > 1 && (
                    <select
                      value={same}
                      disabled={disabled}
                      onChange={(e) => e.target.value && set(keys, e.target.value as AccessLevel)}
                      aria-label={`${group.label}: весь блок`}
                      title="Всем разделам блока"
                      className={selectClass}
                    >
                      {!same && <option value="">Разный доступ</option>}
                      {LEVELS.map((l) => (
                        <option key={l} value={l}>
                          {ACCESS_LEVEL_LABELS[l]}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
              </tr>,
              ...(group.sections.length > 1 || group.sections[0].label !== group.label
                ? group.sections
                : [{ ...group.sections[0], label: "Весь раздел" }]
              ).map((s) => (
                <tr key={s.key} className="border-b border-foreground/5">
                  <td className="py-1.5 pl-4 pr-4 text-foreground/80">{s.label}</td>
                  <td className="py-1.5 text-right">
                    <select
                      value={levels[s.key]}
                      disabled={disabled}
                      onChange={(e) => set([s.key], e.target.value as AccessLevel)}
                      aria-label={`Доступ: ${group.label} → ${s.label}`}
                      className={selectClass}
                    >
                      {LEVELS.map((l) => (
                        <option key={l} value={l}>
                          {ACCESS_LEVEL_LABELS[l]}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              )),
            ];
          })}
        </tbody>
      </table>
      {canEdit && (
        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded-md bg-foreground px-5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Сохраняем..." : "Сохранить"}
          </button>
          {saved && <span className="text-sm text-green-600">Сохранено</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      )}
    </div>
  );
}
