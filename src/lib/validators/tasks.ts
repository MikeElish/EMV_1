import { z } from "zod";

export const TASK_TYPES = ["INCOMING", "OUTGOING"] as const;
export const TASK_TYPE_LABELS: Record<(typeof TASK_TYPES)[number], string> = {
  INCOMING: "Входящая",
  OUTGOING: "Исходящая",
};

export const TASK_BASES = ["INTERNAL", "CUSTOMER_ORDER", "BUYER_COMPANY", "DOCUMENT_FLOW"] as const;
export const TASK_BASIS_LABELS: Record<(typeof TASK_BASES)[number], string> = {
  INTERNAL: "Внутренняя",
  CUSTOMER_ORDER: "Заказ покупателя",
  BUYER_COMPANY: "Карточка покупателя",
  DOCUMENT_FLOW: "Документооборот",
};

export const TASK_KINDS = [
  "LOGISTICS",
  "INTERNAL_LOGISTICS",
  "PROCESSING",
  "SEND_EMAIL",
  "CALL",
  "APPROVE",
  "REVIEW",
  "DOCUMENTS",
  "PAY",
  "MEETING",
] as const;
export const TASK_KIND_LABELS: Record<(typeof TASK_KINDS)[number], string> = {
  LOGISTICS: "Логистика",
  INTERNAL_LOGISTICS: "Внутренняя логистика",
  PROCESSING: "Проработка",
  SEND_EMAIL: "Отправить письмо",
  CALL: "Звонок",
  APPROVE: "Согласовать",
  REVIEW: "Ознакомиться",
  DOCUMENTS: "Документы",
  PAY: "Оплатить",
  MEETING: "Встреча",
};

export const TASK_STATUSES = ["PLANNED", "IN_PROGRESS", "OVERDUE", "DONE", "CANCELLED"] as const;
export const TASK_STATUS_LABELS: Record<(typeof TASK_STATUSES)[number], string> = {
  PLANNED: "Запланировано",
  IN_PROGRESS: "В работе",
  OVERDUE: "Просрочено",
  DONE: "Выполнено",
  CANCELLED: "Отменено",
};

export const TASK_STATUS_COLORS: Record<(typeof TASK_STATUSES)[number], string> = {
  PLANNED: "bg-yellow-400",
  IN_PROGRESS: "bg-yellow-400",
  OVERDUE: "bg-red-500",
  DONE: "bg-green-500",
  CANCELLED: "bg-gray-400",
};

export const taskSchema = z.object({
  assigneeId: z.string().min(1, "Выберите исполнителя"),
  start: z.string().min(1, "Укажите дату начала"),
  end: z.string().min(1, "Укажите дату окончания"),
  basis: z.enum(TASK_BASES),
  type: z.enum(TASK_TYPES),
  kind: z.enum(TASK_KINDS),
  description: z.string().min(1, "Введите описание"),
  sourceType: z.string().optional(),
  sourceId: z.string().optional(),
  sourceNumber: z.string().optional(),
  parentId: z.string().optional(),
});

export type TaskInput = z.infer<typeof taskSchema>;

export const taskResponseSchema = z.object({
  response: z.string().optional(),
});
