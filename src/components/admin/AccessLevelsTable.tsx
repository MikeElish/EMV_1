"use client";

import { ACCESS_GROUPS, ACCESS_LEVEL_LABELS, type AccessLevel, type AccessMap } from "@/lib/access";

const LEVELS = Object.keys(ACCESS_LEVEL_LABELS) as AccessLevel[];
const selectClass =
  "rounded-md border border-foreground/20 bg-background px-2 py-1.5 text-sm outline-none focus:border-foreground/50 disabled:opacity-60";

/** Every admin section with Редактирование / Просмотр / Скрыть; a block-wide list per group. */
export function AccessLevelsTable({
  levels,
  onChange,
  disabled,
}: {
  levels: AccessMap;
  onChange: (keys: string[], level: AccessLevel) => void;
  disabled?: boolean;
}) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {ACCESS_GROUPS.map((group) => {
          const keys = group.sections.map((s) => s.key);
          const same = keys.every((k) => levels[k] === levels[keys[0]]) ? levels[keys[0]] : "";
          const rows =
            group.sections.length > 1 || group.sections[0].label !== group.label
              ? group.sections
              : [{ ...group.sections[0], label: "Весь раздел" }];
          return [
            <tr key={group.path} className="border-b border-foreground/10">
              <th className="pb-2 pt-4 pr-4 text-left font-semibold">{group.label}</th>
              <td className="pb-2 pt-4 text-right">
                {group.sections.length > 1 && (
                  <select
                    value={same}
                    disabled={disabled}
                    onChange={(e) => e.target.value && onChange(keys, e.target.value as AccessLevel)}
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
            ...rows.map((s) => (
              <tr key={s.key} className="border-b border-foreground/5">
                <td className="py-1.5 pl-4 pr-4 text-foreground/80">{s.label}</td>
                <td className="py-1.5 text-right">
                  <select
                    value={levels[s.key]}
                    disabled={disabled}
                    onChange={(e) => onChange([s.key], e.target.value as AccessLevel)}
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
  );
}
