"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createTask, listTasks, respondToTask, updateTaskStatus, type TaskListItem } from "@/actions/crm/tasks";
import {
  TASK_TYPE_LABELS,
  TASK_BASIS_LABELS,
  TASK_KIND_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  TASK_TYPES,
  TASK_BASES,
  TASK_KINDS,
  type TaskInput,
} from "@/lib/validators/tasks";
import { Modal } from "@/components/Modal";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDateInput(value: string): Date | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
}

function formatDateTimeLocal(d: Date) {
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function formatDateShort(iso: string) {
  const d = parseDateInput(iso);
  if (!d) return iso;
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function TasksClient({
  initialTasks,
  initialEmployees,
  error,
}: {
  initialTasks: TaskListItem[];
  initialEmployees: { id: string; name: string }[];
  error: string | null;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskListItem[]>(initialTasks);
  const [loading, startTransition] = useTransition();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [modalParent, setModalParent] = useState<TaskListItem | null>(null);
  const [modalContext, setModalContext] = useState<{ basis: TaskInput["basis"]; sourceType: string; sourceId: string; sourceNumber: string } | null>(null);

  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  useEffect(() => {
    startTransition(async () => {
      const res = await listTasks();
      if (res.ok) setTasks(res.tasks);
    });
  }, []);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskListItem[]>();
    const active = tasks.filter((t) => t.status !== "DONE" && t.status !== "CANCELLED");
    for (const t of active) {
      const start = parseDateInput(t.start);
      const end = parseDateInput(t.end);
      if (!start || !end) continue;
      const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      while (cur <= last) {
        const key = dayKey(cur);
        const list = map.get(key) ?? [];
        list.push(t);
        map.set(key, list);
        cur.setDate(cur.getDate() + 1);
      }
    }
    return map;
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    let list = tasks;
    if (selectedDate) {
      list = list.filter((t) => {
        const start = parseDateInput(t.start);
        const end = parseDateInput(t.end);
        if (!start || !end) return false;
        return selectedDate >= new Date(start.getFullYear(), start.getMonth(), start.getDate()) && selectedDate <= new Date(end.getFullYear(), end.getMonth(), end.getDate());
      });
    }
    const cols = ["start", "end", "type", "basis", "kind", "status", "description", "assigneeName", "creatorName", "sourceNumber"];
    for (const col of cols) {
      const q = (filters[col] ?? "").trim().toLowerCase();
      if (!q) continue;
      list = list.filter((t) => {
        let value = "";
        if (col === "start" || col === "end") value = formatDateShort((t as never)[col]);
        else if (col === "type") value = TASK_TYPE_LABELS[t.type as keyof typeof TASK_TYPE_LABELS] ?? t.type;
        else if (col === "basis") value = TASK_BASIS_LABELS[t.basis as keyof typeof TASK_BASIS_LABELS] ?? t.basis;
        else if (col === "kind") value = TASK_KIND_LABELS[t.kind as keyof typeof TASK_KIND_LABELS] ?? t.kind;
        else if (col === "status") value = TASK_STATUS_LABELS[t.status as keyof typeof TASK_STATUS_LABELS] ?? t.status;
        else value = String((t as never)[col] ?? "");
        return value.toLowerCase().includes(q);
      });
    }
    return list;
  }, [tasks, selectedDate, filters]);

  const selectedTask = useMemo(() => tasks.find((t) => t.id === selectedTaskId) ?? null, [tasks, selectedTaskId]);

  function refresh() {
    startTransition(async () => {
      const res = await listTasks();
      if (res.ok) setTasks(res.tasks);
    });
  }

  function openCreate(parent?: TaskListItem | null, context?: typeof modalContext) {
    setModalParent(parent ?? null);
    setModalContext(context ?? null);
    setModalOpen(true);
  }

  const calendarDays = useMemo(() => {
    const year = month.getFullYear();
    const mon = month.getMonth();
    const first = new Date(year, mon, 1);
    const start = new Date(year, mon, 1 - ((first.getDay() + 6) % 7));
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    }
    return days;
  }, [month]);

  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:grid-rows-[minmax(0,1fr)]">
        {/* Calendar */}
        <div className="rounded-lg border border-foreground/10 p-4 lg:col-span-1">
          <div className="mb-3 flex items-center justify-between">
            <button type="button" onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))} className="text-sm hover:opacity-70">
              ←
            </button>
            <span className="text-sm font-medium capitalize">
              {month.toLocaleString("ru-RU", { month: "long", year: "numeric" })}
            </span>
            <button type="button" onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))} className="text-sm hover:opacity-70">
              →
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-foreground/60">
            {WEEKDAYS.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {calendarDays.map((d, i) => {
              const key = dayKey(d);
              const has = (tasksByDay.get(key) ?? []).length > 0;
              const isCurrent = sameDay(d, new Date());
              const isSelected = selectedDate && sameDay(d, selectedDate);
              const inMonth = d.getMonth() === month.getMonth();
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedDate(isSelected ? null : d)}
                  className={[
                    "relative aspect-square rounded-md text-xs transition-colors",
                    inMonth ? "text-foreground" : "text-foreground/30",
                    has ? "bg-foreground/10" : "",
                    isCurrent ? "font-bold ring-2 ring-foreground/40" : "",
                    isSelected ? "animate-pulse ring-2 ring-foreground" : "",
                    "hover:bg-foreground/5",
                  ].join(" ")}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tasks table */}
        <div className="rounded-lg border border-foreground/10 p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Задачи</h2>
            <button
              type="button"
              onClick={() => openCreate()}
              className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
            >
              +
            </button>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-foreground/5">
                <tr>
                  {[
                    { key: "start", label: "Начало" },
                    { key: "end", label: "Окончание" },
                    { key: "type", label: "Тип" },
                    { key: "basis", label: "Основание" },
                    { key: "kind", label: "Вид" },
                    { key: "status", label: "Статус" },
                  ].map((c) => (
                    <th key={c.key} className="px-2 py-1 text-left font-medium">
                      <div>{c.label}</div>
                      <input
                        value={filters[c.key] ?? ""}
                        onChange={(e) => setFilters((f) => ({ ...f, [c.key]: e.target.value }))}
                        className="mt-1 w-full rounded border border-foreground/20 bg-transparent px-1 py-0.5 text-[10px] outline-none"
                        placeholder="фильтр"
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setSelectedTaskId(t.id)}
                    className={[
                      "cursor-pointer border-b border-foreground/5 hover:bg-foreground/5",
                      selectedTaskId === t.id ? "bg-foreground/10" : "",
                    ].join(" ")}
                  >
                    <td className="px-2 py-1.5">{formatDateShort(t.start)}</td>
                    <td className="px-2 py-1.5">{formatDateShort(t.end)}</td>
                    <td className="px-2 py-1.5">{TASK_TYPE_LABELS[t.type as keyof typeof TASK_TYPE_LABELS]}</td>
                    <td className="px-2 py-1.5">
                      {TASK_BASIS_LABELS[t.basis as keyof typeof TASK_BASIS_LABELS]}
                      {t.sourceNumber && (
                        <div>
                          {t.sourceType === "ORDER" ? (
                            <Link href={`/admin/crm/orders?orderNumber=${encodeURIComponent(t.sourceNumber)}`} className="text-blue-600 hover:underline">
                              {t.sourceNumber}
                            </Link>
                          ) : (
                            <span className="text-foreground/60">{t.sourceNumber}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-1.5">{TASK_KIND_LABELS[t.kind as keyof typeof TASK_KIND_LABELS]}</td>
                    <td className="px-2 py-1.5">
                      <span className={["rounded px-1.5 py-0.5 text-[10px] text-white", TASK_STATUS_COLORS[t.status as keyof typeof TASK_STATUS_COLORS] || "bg-gray-400"].join(" ")}>
                        {TASK_STATUS_LABELS[t.status as keyof typeof TASK_STATUS_LABELS] ?? t.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredTasks.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-2 py-4 text-center text-foreground/50">
                      Нет задач
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Subordination tree */}
        <div className="rounded-lg border border-foreground/10 p-4 lg:col-span-1">
          <h2 className="mb-2 text-sm font-medium">Структура подчинённости</h2>
          <TaskTree tasks={tasks} selectedId={selectedTaskId} onSelect={setSelectedTaskId} />
        </div>

        {/* Preview */}
        <div className="rounded-lg border border-foreground/10 p-4 lg:col-span-2">
          <h2 className="mb-2 text-sm font-medium">Просмотр</h2>
          {selectedTask ? (
            <TaskPreview task={selectedTask} employees={initialEmployees} onRefresh={refresh} onCreateSubtask={() => openCreate(selectedTask)} />
          ) : (
            <p className="text-sm text-foreground/50">Выберите задачу</p>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {modalOpen && (
        <TaskModal
          employees={initialEmployees}
          parent={modalParent}
          context={modalContext}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function TaskTree({ tasks, selectedId, onSelect }: { tasks: TaskListItem[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const byParent = useMemo(() => {
    const map = new Map<string | null, TaskListItem[]>();
    for (const t of tasks) {
      const list = map.get(t.parentId) ?? [];
      list.push(t);
      map.set(t.parentId, list);
    }
    return map;
  }, [tasks]);

  function renderNode(parentId: string | null, depth = 0) {
    const children = byParent.get(parentId) ?? [];
    return children.map((t) => (
      <div key={t.id} style={{ paddingLeft: depth * 16 }}>
        <button
          type="button"
          onClick={() => onSelect(t.id)}
          className={[
            "flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs",
            TASK_STATUS_COLORS[t.status as keyof typeof TASK_STATUS_COLORS] ?? "bg-gray-400",
            selectedId === t.id ? "ring-2 ring-foreground" : "",
          ].join(" ")}
        >
          {depth > 0 && <span>└</span>}
          <span className="text-white">
            {TASK_KIND_LABELS[t.kind as keyof typeof TASK_KIND_LABELS]} ({t.creatorName || "EMV"})
          </span>
        </button>
        {renderNode(t.id, depth + 1)}
      </div>
    ));
  }

  return <div className="space-y-1">{renderNode(null)}</div>;
}

function TaskPreview({
  task,
  employees,
  onRefresh,
  onCreateSubtask,
}: {
  task: TaskListItem;
  employees: { id: string; name: string }[];
  onRefresh: () => void;
  onCreateSubtask: () => void;
}) {
  const [response, setResponse] = useState(task.response ?? "");
  const [pending, start] = useTransition();

  function act(action: () => Promise<{ ok: false; error: string } | { ok: true }>) {
    start(async () => {
      const res = await action();
      if (!res.ok) alert(res.error);
      onRefresh();
    });
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs text-foreground/60">
        <span>
          {task.start} → {task.end}
        </span>
        <span>·</span>
        <span>{TASK_STATUS_LABELS[task.status as keyof typeof TASK_STATUS_LABELS]}</span>
        <span>·</span>
        <span>{task.creatorName || "EMV"}</span>
        <span>→</span>
        <span>{task.assigneeName}</span>
      </div>
      <div className="whitespace-pre-wrap rounded bg-foreground/5 p-3">{task.description}</div>
      <div>
        <label className="text-xs text-foreground/60">Ответ</label>
        <textarea
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          className="mt-1 min-h-[80px] w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => act(() => respondToTask(task.id, response))}
            className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90 disabled:opacity-50"
          >
            Сохранить ответ
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => act(() => updateTaskStatus(task.id, "DONE"))}
            className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            Выполнено
          </button>
          {task.status !== "DONE" && task.status !== "CANCELLED" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => act(() => updateTaskStatus(task.id, "CANCELLED"))}
              className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Отмена
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={onCreateSubtask}
            className="rounded-md bg-foreground/10 px-3 py-1.5 text-xs font-medium hover:bg-foreground/20 disabled:opacity-50"
          >
            Создать подзадачу
          </button>
        </div>
      </div>
    </div>
  );
}

function TaskModal({
  employees,
  parent,
  context,
  onClose,
  onSaved,
}: {
  employees: { id: string; name: string }[];
  parent: TaskListItem | null;
  context: { basis: TaskInput["basis"]; sourceType: string; sourceId: string; sourceNumber: string } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [assigneeId, setAssigneeId] = useState(parent?.assigneeId ?? employees[0]?.id ?? "");
  const [start, setStart] = useState(formatDateTimeLocal(new Date()));
  const [end, setEnd] = useState(formatDateTimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000)));
  const [type, setType] = useState<TaskInput["type"]>("INCOMING");
  const [basis, setBasis] = useState<TaskInput["basis"]>(context?.basis ?? (parent?.basis as TaskInput["basis"]) ?? "INTERNAL");
  const [kind, setKind] = useState<TaskInput["kind"]>("PROCESSING");
  const [description, setDescription] = useState("");
  const [pending, startTransition] = useTransition();

  const locked = !!context || !!parent;

  function save() {
    startTransition(async () => {
      const input: TaskInput = {
        assigneeId,
        start,
        end,
        type,
        basis,
        kind,
        description,
        sourceType: context?.sourceType ?? parent?.sourceType ?? undefined,
        sourceId: context?.sourceId ?? parent?.sourceId ?? undefined,
        sourceNumber: context?.sourceNumber ?? parent?.sourceNumber ?? undefined,
        parentId: parent?.id,
      };
      const res = await createTask(input);
      if (!res.ok) alert(res.error);
      else onSaved();
    });
  }

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-lg">
      <h2 className="text-lg font-bold">{parent ? "Создать подзадачу" : "Новая задача"}</h2>
      <div className="mt-4 space-y-3">
        <div>
          <label className="text-xs text-foreground/60">Исполнитель</label>
          <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none">
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
          <select
            value={basis}
            onChange={(e) => setBasis(e.target.value as TaskInput["basis"])}
            disabled={locked}
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none disabled:opacity-60"
          >
            {TASK_BASES.map((b) => (
              <option key={b} value={b}>
                {TASK_BASIS_LABELS[b]}
              </option>
            ))}
          </select>
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
          <button type="button" disabled={pending} onClick={save} className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
            Сохранить
          </button>
        </div>
      </div>
    </Modal>
  );
}
