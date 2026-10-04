"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/Modal";
import {
  deleteMailRule,
  moveMailRule,
  saveMailRule,
  setMailRuleEnabled,
} from "@/actions/mail/rules";
import {
  RULE_ATTACHMENTS,
  RULE_FIELDS,
  RULE_OPS,
  describeConditions,
  type MailRuleCondition,
  type MailRuleInput,
  type RuleAttachments,
  type RuleField,
  type RuleOp,
} from "@/lib/validators/mail-rules";

export type RuleRow = {
  id: string;
  name: string;
  enabled: boolean;
  matchAll: boolean;
  conditions: MailRuleCondition[];
  attachments: RuleAttachments;
  moveTo: string | null;
  markRead: boolean;
  flag: boolean;
  remove: boolean;
  forwardTo: string | null;
  replyText: string | null;
  stopProcessing: boolean;
};

export type RuleFolder = { path: string; name: string };

const fieldClass =
  "rounded-md border border-foreground/20 bg-background px-2 py-1.5 text-sm outline-none focus:border-foreground/50";
const inputClass = `w-full ${fieldClass}`;

function actionsText(rule: RuleRow, folders: RuleFolder[]) {
  const list: string[] = [];
  if (rule.remove) list.push("удалить");
  else if (rule.moveTo) list.push(`в папку «${folders.find((f) => f.path === rule.moveTo)?.name ?? rule.moveTo}»`);
  if (rule.markRead) list.push("отметить прочитанным");
  if (rule.flag) list.push("отметить важным");
  if (rule.forwardTo) list.push(`переслать на ${rule.forwardTo}`);
  if (rule.replyText) list.push("автоответ");
  if (rule.stopProcessing) list.push("не применять остальные правила");
  return list.join(", ");
}

const emptyCondition = (): MailRuleCondition => ({ field: "from", op: "contains", value: "" });

function RuleEditor({
  rule,
  folders,
  onClose,
}: {
  rule: RuleRow | null;
  folders: RuleFolder[];
  onClose: () => void;
}) {
  const [name, setName] = useState(rule?.name ?? "");
  const [matchAll, setMatchAll] = useState(rule?.matchAll ?? true);
  const [conditions, setConditions] = useState<MailRuleCondition[]>(rule?.conditions ?? [emptyCondition()]);
  const [attachments, setAttachments] = useState<RuleAttachments>(rule?.attachments ?? "any");
  const [moveOn, setMoveOn] = useState(!!rule?.moveTo);
  const [moveTo, setMoveTo] = useState(rule?.moveTo ?? folders[0]?.path ?? "");
  const [markRead, setMarkRead] = useState(rule?.markRead ?? false);
  const [flag, setFlag] = useState(rule?.flag ?? false);
  const [remove, setRemove] = useState(rule?.remove ?? false);
  const [forwardOn, setForwardOn] = useState(!!rule?.forwardTo);
  const [forwardTo, setForwardTo] = useState(rule?.forwardTo ?? "");
  const [replyOn, setReplyOn] = useState(!!rule?.replyText);
  const [replyText, setReplyText] = useState(rule?.replyText ?? "");
  const [stopProcessing, setStopProcessing] = useState(rule?.stopProcessing ?? false);
  const [applyToInbox, setApplyToInbox] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function setCondition(index: number, patch: Partial<MailRuleCondition>) {
    setConditions((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function save() {
    setError(null);
    const input: MailRuleInput = {
      name: name.trim() || undefined,
      matchAll,
      conditions,
      attachments,
      moveTo: moveOn && !remove ? moveTo : undefined,
      markRead,
      flag,
      remove,
      forwardTo: forwardOn ? forwardTo : "",
      replyText: replyOn ? replyText : undefined,
      stopProcessing,
    };
    startTransition(async () => {
      const result = await saveMailRule(rule?.id ?? null, input, applyToInbox);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.applied !== undefined) {
        setNotice(`Правило сохранено и применено к ${result.applied} письм(ам) во Входящих.`);
        return;
      }
      onClose();
    });
  }

  if (notice) {
    return (
      <Modal onClose={onClose} maxWidthClassName="max-w-md">
        <p className="text-sm">{notice}</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 rounded-md bg-foreground px-5 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          Готово
        </button>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-3xl">
      <h2 className="text-lg font-semibold">{rule ? "Изменить правило" : "Новое правило"}</h2>

      <div className="mt-4 space-y-5 text-sm">
        <section>
          <p className="font-medium">
            Применять к письмам{" "}
            <select
              value={attachments}
              onChange={(e) => setAttachments(e.target.value as RuleAttachments)}
              className="ml-1 rounded-md border border-foreground/20 bg-background px-2 py-1 text-sm"
            >
              {(Object.keys(RULE_ATTACHMENTS) as RuleAttachments[]).map((k) => (
                <option key={k} value={k}>
                  {RULE_ATTACHMENTS[k]}
                </option>
              ))}
            </select>
          </p>
        </section>

        <section>
          <p className="font-medium">
            Если{" "}
            <select
              value={matchAll ? "all" : "any"}
              onChange={(e) => setMatchAll(e.target.value === "all")}
              className="ml-1 rounded-md border border-foreground/20 bg-background px-2 py-1 text-sm"
            >
              <option value="all">выполняются все условия</option>
              <option value="any">выполняется хотя бы одно условие</option>
            </select>
          </p>
          <div className="mt-2 space-y-2">
            {conditions.map((c, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Поле"
                  value={c.field}
                  onChange={(e) => setCondition(i, { field: e.target.value as RuleField })}
                  className={`${fieldClass} w-44`}
                >
                  {(Object.keys(RULE_FIELDS) as RuleField[]).map((k) => (
                    <option key={k} value={k}>
                      {RULE_FIELDS[k]}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Условие"
                  value={c.op}
                  onChange={(e) => setCondition(i, { op: e.target.value as RuleOp })}
                  className={`${fieldClass} w-40`}
                >
                  {(Object.keys(RULE_OPS) as RuleOp[]).map((k) => (
                    <option key={k} value={k}>
                      {RULE_OPS[k]}
                    </option>
                  ))}
                </select>
                <input
                  aria-label="Значение"
                  value={c.value}
                  onChange={(e) => setCondition(i, { value: e.target.value })}
                  placeholder="адрес, слово или фраза"
                  className={`${fieldClass} min-w-48 flex-1`}
                />
                {conditions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setConditions((prev) => prev.filter((_, j) => j !== i))}
                    aria-label="Удалить условие"
                    className="px-2 text-foreground/40 hover:text-red-600"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setConditions((prev) => [...prev, emptyCondition()])}
            className="mt-2 text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            + Добавить условие
          </button>
        </section>

        <section className="space-y-2">
          <p className="font-medium">Выполнить действие</p>
          <label className="flex flex-wrap items-center gap-2">
            <input type="checkbox" checked={moveOn && !remove} disabled={remove} onChange={(e) => setMoveOn(e.target.checked)} />
            Положить в папку
            <select
              value={moveTo}
              disabled={!moveOn || remove}
              onChange={(e) => setMoveTo(e.target.value)}
              className="rounded-md border border-foreground/20 bg-background px-2 py-1 text-sm disabled:opacity-50"
            >
              {folders.map((f) => (
                <option key={f.path} value={f.path}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={markRead} onChange={(e) => setMarkRead(e.target.checked)} />
            Отметить прочитанным
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={flag} onChange={(e) => setFlag(e.target.checked)} />
            Отметить как важное
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={remove} onChange={(e) => setRemove(e.target.checked)} />
            Удалить (в Удалённые)
          </label>
          <label className="flex flex-wrap items-center gap-2">
            <input type="checkbox" checked={forwardOn} onChange={(e) => setForwardOn(e.target.checked)} />
            Переслать по адресу
            <input
              type="email"
              value={forwardTo}
              disabled={!forwardOn}
              onChange={(e) => setForwardTo(e.target.value)}
              placeholder="name@example.com"
              className="w-64 rounded-md border border-foreground/20 bg-background px-2 py-1 text-sm disabled:opacity-50"
            />
          </label>
          <div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={replyOn} onChange={(e) => setReplyOn(e.target.checked)} />
              Ответить следующим текстом
            </label>
            {replyOn && (
              <>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={3}
                  className={`${inputClass} mt-2`}
                />
                <p className="mt-1 text-xs text-foreground/50">
                  Не чаще одного ответа одному отправителю в сутки; рассылкам и автоматическим письмам не отвечаем.
                </p>
              </>
            )}
          </div>
          <label className="flex items-center gap-2 pt-1">
            <input type="checkbox" checked={stopProcessing} onChange={(e) => setStopProcessing(e.target.checked)} />
            Не применять остальные правила
          </label>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="rule-name" className="text-foreground/60">
              Название правила
            </label>
            <input
              id="rule-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="по умолчанию — по условиям"
              className={`${inputClass} mt-1`}
            />
          </div>
          <label className="flex items-end gap-2 pb-2">
            <input type="checkbox" checked={applyToInbox} onChange={(e) => setApplyToInbox(e.target.checked)} />
            Применить к письмам, которые уже во Входящих
          </label>
        </section>

        {error && <p className="text-red-600">{error}</p>}
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-md bg-foreground px-5 py-2 font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Сохраняем..." : "Сохранить правило"}
        </button>
      </div>
    </Modal>
  );
}

export function MailRulesSettings({
  rules,
  folders,
  foldersError,
}: {
  rules: RuleRow[];
  folders: RuleFolder[];
  foldersError: string | null;
}) {
  const [editing, setEditing] = useState<RuleRow | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? "Ошибка");
    });
  }

  return (
    <div>
      <h2 className="text-lg font-semibold">Правила обработки писем</h2>
      <p className="mt-1 text-sm text-foreground/60">
        Правила применяются по порядку к новым письмам во Входящих — в течение минуты после прихода письма и сразу при
        открытии Входящих.
      </p>
      {foldersError && <p className="mt-2 text-sm text-red-600">{foldersError}</p>}

      <button
        type="button"
        onClick={() => setEditing("new")}
        className="mt-4 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
      >
        Создать правило
      </button>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {rules.length === 0 ? (
        <p className="mt-6 text-sm text-foreground/50">Правил пока нет.</p>
      ) : (
        <ul className="mt-5 divide-y divide-foreground/10 rounded-lg border border-foreground/10">
          {rules.map((rule, i) => (
            <li key={rule.id} className={`flex items-start gap-3 p-3 ${rule.enabled ? "" : "opacity-60"}`}>
              <div className="flex flex-col">
                <button
                  type="button"
                  disabled={pending || i === 0}
                  onClick={() => run(() => moveMailRule(rule.id, -1))}
                  aria-label="Выше"
                  className="px-1 text-foreground/50 hover:text-foreground disabled:opacity-20"
                >
                  ▲
                </button>
                <button
                  type="button"
                  disabled={pending || i === rules.length - 1}
                  onClick={() => run(() => moveMailRule(rule.id, 1))}
                  aria-label="Ниже"
                  className="px-1 text-foreground/50 hover:text-foreground disabled:opacity-20"
                >
                  ▼
                </button>
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium">{rule.name}</p>
                <p className="mt-0.5 text-foreground/60">
                  Если {describeConditions(rule.conditions, rule.matchAll)}
                  {rule.attachments !== "any" && ` (${RULE_ATTACHMENTS[rule.attachments]})`}
                </p>
                <p className="text-foreground/60">→ {actionsText(rule, folders)}</p>
              </div>
              <label className="flex shrink-0 items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  disabled={pending}
                  onChange={(e) => run(() => setMailRuleEnabled(rule.id, e.target.checked))}
                />
                Включено
              </label>
              <button
                type="button"
                onClick={() => setEditing(rule)}
                className="shrink-0 text-sm hover:underline"
              >
                Изменить
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (confirm(`Удалить правило «${rule.name}»?`)) run(() => deleteMailRule(rule.id));
                }}
                className="shrink-0 text-sm text-red-600 hover:underline"
              >
                Удалить
              </button>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <RuleEditor rule={editing === "new" ? null : editing} folders={folders} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
