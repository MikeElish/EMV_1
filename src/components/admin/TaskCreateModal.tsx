"use client";

import { useEffect, useState, useTransition } from "react";
import { createTask, listEmployees } from "@/actions/crm/tasks";
import { Modal } from "@/components/Modal";
import { TASK_TYPE_LABELS, TASK_BASIS_LABELS, TASK_KIND_LABELS, TASK_TYPES, TASK_KINDS, type TaskInput } from "@/lib/validators/tasks";

function formatDateTimeLocal(d: Date) {
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

export type TaskSource = {
  basis: TaskInput["basis"];
  sourceType: string;
  sourceId: string;
  sourceNumber: string;
};

export function TaskCreateModal({
  source,
  parentId,
  onClose,
  onCreated,
}: {
  source: TaskSource;
  parentId?: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [assigneeId, setAssigneeId] = useState("");
  const [start, setStart] = useState(formatDateTimeLocal(new Date()));
  const [end, setEnd] = useState(formatDateTimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000)));
  const [type, setType] = useState<TaskInput["type"]>("INCOMING");
  const [kind, setKind] = useState<TaskInput["kind"]>("PROCESSING");
  const [description, setDescription] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    listEmployees().then((res) => {
      if (res.ok) {
        setEmployees(res.employees);
        setAssigneeId(res.employees[0]?.id ?? "");
      }
    });
  }, []);

  function save() {
    startTransition(async () => {
      const res = await createTask({
        assigneeId,
        start,
        end,
        type,
        basis: source.basis,
        kind,
        description,
        sourceType: source.sourceType,
        sourceId: source.sourceId,
        sourceNumber: source.sourceNumber,
        parentId,
      });
      if (!res.ok) alert(res.error);
      else onCreated();
    });
  }

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-lg">
      <h2 className="text-lg font-bold">{parentId ? "Создать подзадачу" : "Новая задача"}</h2>
      <div className="mt-4 space-y-3">
        <div>
          <label className="text-xs text-foreground/60">Исполнитель</label>
          <select
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none"
          >
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-foreground/60">Начало</label>
            <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none" />
          </div>
          <div>
            <label className="text-xs text-foreground/60">Окончание</label>
            <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none" />
          </div>
        </div>
        <div>
          <label className="text-xs text-foreground/60">Основание</label>
          <input
            type="text"
            readOnly
            value={TASK_BASIS_LABELS[source.basis]}
            className="mt-1 w-full rounded-md border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm outline-none"
          />
          {source.sourceNumber && <div className="mt-1 text-xs text-foreground/60">{source.sourceNumber}</div>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-foreground/60">Тип</label>
            <select value={type} onChange={(e) => setType(e.target.value as TaskInput["type"])} className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none">
              {TASK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TASK_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-foreground/60">Вид</label>
            <select value={kind} onChange={(e) => setKind(e.target.value as TaskInput["kind"])} className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none">
              {TASK_KINDS.map((k) => (
                <option key={k} value={k}>
                  {TASK_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs text-foreground/60">Описание</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 min-h-[100px] w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
            Отмена
          </button>
          <button type="button" disabled={pending || !assigneeId} onClick={save} className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
            Сохранить
          </button>
        </div>
      </div>
    </Modal>
  );
}
