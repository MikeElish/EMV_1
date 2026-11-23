"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/session";
import { accessDenied } from "@/lib/access-server";
import { taskSchema, taskResponseSchema } from "@/lib/validators/tasks";
import { spawnManagerTaskAfterAssignment } from "@/lib/task-automation";

export type TaskListItem = {
  id: string;
  start: string;
  end: string;
  type: string;
  basis: string;
  kind: string;
  status: string;
  description: string;
  response: string | null;
  sourceType: string | null;
  sourceId: string | null;
  sourceNumber: string | null;
  parentId: string | null;
  creatorId: string;
  creatorName: string;
  assigneeId: string;
  assigneeName: string;
  children: { id: string; kind: string; status: string; creatorName: string; assigneeName: string }[];
};

export async function listTasks(): Promise<{ ok: true; tasks: TaskListItem[] } | { ok: false; error: string }> {
  const session = await getAdminSession();
  if (!session) return { ok: false, error: "Требуется вход" };
  const denied = await accessDenied("crm.tasks", "view");
  if (denied) return denied;

  const tasks = await prisma.task.findMany({
    where: { OR: [{ assigneeId: session.userId }, { creatorId: session.userId }] },
    orderBy: [{ end: "asc" }, { createdAt: "desc" }],
    include: {
      creator: { select: { id: true, lastName: true, firstName: true } },
      assignee: { select: { id: true, lastName: true, firstName: true } },
      children: { select: { id: true, kind: true, status: true, creator: { select: { lastName: true, firstName: true } }, assignee: { select: { lastName: true, firstName: true } } } },
    },
  });

  const now = new Date();
  const items: TaskListItem[] = tasks.map((t) => {
    const status = computeStatus(t.status, t.end, now);
    return {
      id: t.id,
      start: toIsoLocal(t.start),
      end: toIsoLocal(t.end),
      type: t.type,
      basis: t.basis,
      kind: t.kind,
      status,
      description: t.description,
      response: t.response,
      sourceType: t.sourceType,
      sourceId: t.sourceId,
      sourceNumber: t.sourceNumber,
      parentId: t.parentId,
      creatorId: t.creatorId,
      creatorName: userName(t.creator),
      assigneeId: t.assigneeId,
      assigneeName: userName(t.assignee),
      children: t.children.map((c) => ({
        id: c.id,
        kind: c.kind,
        status: computeStatus(c.status, t.end, now),
        creatorName: userName(c.creator),
        assigneeName: userName(c.assignee),
      })),
    };
  });
  return { ok: true, tasks: items };
}

export async function createTask(input: unknown): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const session = await getAdminSession();
  if (!session) return { ok: false, error: "Требуется вход" };
  const denied = await accessDenied("crm.tasks", "edit");
  if (denied) return denied;

  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  const data = parsed.data;

  const start = parseLocalDate(data.start);
  const end = parseLocalDate(data.end);
  if (!start || !end) return { ok: false, error: "Некорректная дата" };
  if (end < start) return { ok: false, error: "Окончание не может быть раньше начала" };

  let basis = data.basis;
  let sourceType = data.sourceType ?? null;
  let sourceId = data.sourceId ?? null;
  let sourceNumber = data.sourceNumber ?? null;

  if (data.parentId) {
    const parent = await prisma.task.findUnique({ where: { id: data.parentId }, select: { basis: true, sourceType: true, sourceId: true, sourceNumber: true } });
    if (!parent) return { ok: false, error: "Родительская задача не найдена" };
    basis = parent.basis;
    sourceType = parent.sourceType;
    sourceId = parent.sourceId;
    sourceNumber = parent.sourceNumber;
  }

  const task = await prisma.task.create({
    data: {
      creatorId: session.userId,
      assigneeId: data.assigneeId,
      start,
      end,
      type: data.type,
      basis,
      kind: data.kind,
      description: data.description,
      sourceType,
      sourceId,
      sourceNumber,
      parentId: data.parentId ?? null,
      status: "PLANNED",
    },
  });
  revalidatePath("/admin/tasks");
  return { ok: true, id: task.id };
}

export async function updateTaskStatus(
  id: string,
  status: "DONE" | "CANCELLED" | "IN_PROGRESS" | "PLANNED"
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getAdminSession();
  if (!session) return { ok: false, error: "Требуется вход" };
  const denied = await accessDenied("crm.tasks", "edit");
  if (denied) return denied;

  const task = await prisma.task.findUnique({ where: { id }, select: { assigneeId: true, creatorId: true, status: true, basis: true, sourceType: true, sourceId: true } });
  if (!task) return { ok: false, error: "Задача не найдена" };
  if (task.status === "DONE" || task.status === "CANCELLED") return { ok: false, error: "Задача уже завершена" };
  if (session.userId !== task.assigneeId && session.userId !== task.creatorId) {
    const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true } });
    if (me?.role !== "OWNER") return { ok: false, error: "Нет прав на изменение задачи" };
  }

  await prisma.task.update({ where: { id }, data: { status } });

  if (status === "DONE" && task.basis === "BUYER_COMPANY" && task.sourceType === "ORDER" && task.sourceId) {
    await spawnManagerTaskAfterAssignment(task.sourceId);
  }

  revalidatePath("/admin/tasks");
  return { ok: true };
}

export async function respondToTask(
  id: string,
  response: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getAdminSession();
  if (!session) return { ok: false, error: "Требуется вход" };
  const denied = await accessDenied("crm.tasks", "edit");
  if (denied) return denied;

  const parsed = taskResponseSchema.safeParse({ response });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };

  const task = await prisma.task.findUnique({ where: { id }, select: { assigneeId: true, creatorId: true } });
  if (!task) return { ok: false, error: "Задача не найдена" };
  if (session.userId !== task.assigneeId && session.userId !== task.creatorId) {
    const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true } });
    if (me?.role !== "OWNER") return { ok: false, error: "Нет прав на изменение задачи" };
  }

  await prisma.task.update({ where: { id }, data: { response } });
  revalidatePath("/admin/tasks");
  return { ok: true };
}

export async function listEmployees(): Promise<{ ok: true; employees: { id: string; name: string }[] } | { ok: false; error: string }> {
  const session = await getAdminSession();
  if (!session) return { ok: false, error: "Требуется вход" };
  const users = await prisma.user.findMany({
    where: { role: { not: "CUSTOMER" } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, lastName: true, firstName: true, login: true },
  });
  return {
    ok: true,
    employees: users.map((u) => ({ id: u.id, name: userName(u) || u.login })),
  };
}

function userName(u: { lastName: string | null; firstName: string | null }) {
  return [u.lastName, u.firstName].filter(Boolean).join(" ") || "";
}

function toIsoLocal(d: Date) {
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function parseLocalDate(value: string): Date | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [_, y, mo, d, h, mi] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  if (isNaN(date.getTime())) return null;
  return date;
}

function computeStatus(dbStatus: string, end: Date, now: Date): string {
  if (dbStatus === "DONE" || dbStatus === "CANCELLED") return dbStatus;
  if (end < now) return "OVERDUE";
  if (dbStatus === "IN_PROGRESS") return "IN_PROGRESS";
  return "PLANNED";
}
