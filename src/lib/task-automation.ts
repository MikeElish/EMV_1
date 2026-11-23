import "server-only";
import { prisma } from "@/lib/prisma";

const EMV_LOGIN = "emv";

async function emvUserId(): Promise<string | null> {
  // A dedicated system user is preferred; otherwise the first owner is the EMV initiator.
  const system = await prisma.user.findUnique({ where: { login: EMV_LOGIN }, select: { id: true } });
  if (system) return system.id;
  const owner = await prisma.user.findFirst({ where: { role: "OWNER" }, orderBy: { createdAt: "asc" }, select: { id: true } });
  return owner?.id ?? null;
}

async function ownerId(): Promise<string | null> {
  const owner = await prisma.user.findFirst({ where: { role: "OWNER" }, orderBy: { createdAt: "asc" }, select: { id: true } });
  return owner?.id ?? null;
}

async function resolveAssignee(managerId: string | null): Promise<string | null> {
  if (managerId) return managerId;
  return ownerId();
}

function endOfDayFrom(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 59, 999);
  return d;
}

async function ensureEmvTask(
  input: {
    assigneeId: string;
    basis: "INTERNAL" | "CUSTOMER_ORDER" | "BUYER_COMPANY" | "DOCUMENT_FLOW";
    kind: "PROCESSING" | "LOGISTICS" | "PAY" | "DOCUMENTS";
    description: string;
    sourceType?: string;
    sourceId?: string;
    sourceNumber?: string;
    parentId?: string;
    start?: Date;
    end?: Date;
  },
  dedup?: { sourceType: string; sourceId: string; kind: import("@prisma/client").TaskKind; assigneeId: string }
) {
  const creatorId = await emvUserId();
  if (!creatorId) return null;
  if (dedup) {
    const existing = await prisma.task.findFirst({
      where: { sourceType: dedup.sourceType, sourceId: dedup.sourceId, kind: dedup.kind, assigneeId: dedup.assigneeId, status: { not: "CANCELLED" } },
    });
    if (existing) return existing.id;
  }
  const now = new Date();
  return prisma.task.create({
    data: {
      creatorId,
      assigneeId: input.assigneeId,
      basis: input.basis,
      kind: input.kind,
      type: "INCOMING",
      description: input.description,
      sourceType: input.sourceType ?? null,
      sourceId: input.sourceId ?? null,
      sourceNumber: input.sourceNumber ?? null,
      parentId: input.parentId ?? null,
      start: input.start ?? now,
      end: input.end ?? endOfDayFrom(now, 1),
      status: "PLANNED",
    },
  }).then((t) => t.id);
}

export async function createOrderTask(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { orderNumber: true, managerId: true, buyerCompanyId: true, userId: true },
  });
  if (!order) return;
  if (order.managerId) {
    await ensureEmvTask(
      {
        assigneeId: order.managerId,
        basis: "CUSTOMER_ORDER",
        kind: "PROCESSING",
        description: `Поступил новый заказ ${order.orderNumber}.`,
        sourceType: "ORDER",
        sourceId: orderId,
        sourceNumber: order.orderNumber,
      },
      { sourceType: "ORDER", sourceId: orderId, kind: "PROCESSING", assigneeId: order.managerId }
    );
    return;
  }
  // No manager: ask the owner to assign one.
  const owner = await prisma.user.findFirst({ where: { role: "OWNER" }, orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!owner) return;
  await ensureEmvTask(
    {
      assigneeId: owner.id,
      basis: "BUYER_COMPANY",
      kind: "PROCESSING",
      description: `Поступил новый заказ ${order.orderNumber}. Менеджер не закреплён – закрепите менеджера.`,
      sourceType: "ORDER",
      sourceId: orderId,
      sourceNumber: order.orderNumber,
    },
    { sourceType: "ORDER", sourceId: orderId, kind: "PROCESSING", assigneeId: owner.id }
  );
}

export async function createPaymentTask(orderId: string, amount: number) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { orderNumber: true, managerId: true },
  });
  if (!order) return;
  const assigneeId = await resolveAssignee(order.managerId);
  if (!assigneeId) return;
  await ensureEmvTask(
    {
      assigneeId,
      basis: "CUSTOMER_ORDER",
      kind: "PROCESSING",
      description: `По заказу ${order.orderNumber} поступила оплата в размере ${(amount / 100).toLocaleString("ru-RU")} ₽. Создайте Заказ поставщику или отгрузите товар.`,
      sourceType: "ORDER",
      sourceId: orderId,
      sourceNumber: order.orderNumber,
    },
    { sourceType: "ORDER", sourceId: orderId, kind: "PROCESSING", assigneeId }
  );
}

export async function createSupplyTask(orderId: string, supplierOrderNumber: string, itemsText: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { orderNumber: true, managerId: true },
  });
  if (!order) return;
  const assigneeId = await resolveAssignee(order.managerId);
  if (!assigneeId) return;
  await ensureEmvTask(
    {
      assigneeId,
      basis: "CUSTOMER_ORDER",
      kind: "PROCESSING",
      description: `По заказу поставщику ${supplierOrderNumber} поступил товар:\n${itemsText}\nОтгрузите товар.`,
      sourceType: "ORDER",
      sourceId: orderId,
      sourceNumber: order.orderNumber,
    },
    { sourceType: "ORDER", sourceId: orderId, kind: "PROCESSING", assigneeId }
  );
}

export async function spawnManagerTaskAfterAssignment(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { orderNumber: true, managerId: true },
  });
  if (!order?.managerId) return;
  await ensureEmvTask(
    {
      assigneeId: order.managerId,
      basis: "CUSTOMER_ORDER",
      kind: "PROCESSING",
      description: `Поступил новый заказ ${order.orderNumber}.`,
      sourceType: "ORDER",
      sourceId: orderId,
      sourceNumber: order.orderNumber,
    },
    { sourceType: "ORDER", sourceId: orderId, kind: "PROCESSING", assigneeId: order.managerId }
  );
}

export async function createOverduePaymentTasks(): Promise<number> {
  const creatorId = await emvUserId();
  if (!creatorId) return 0;

  const orders = await prisma.order.findMany({
    where: { paid: false, shippedAt: { not: null }, status: { not: "CANCELLED" } },
    select: {
      id: true,
      orderNumber: true,
      shippedAt: true,
      managerId: true,
      user: { select: { company: { select: { paymentDeferralDays: true } } } },
    },
  });

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let created = 0;

  for (const order of orders) {
    if (!order.shippedAt) continue;
    const assigneeId = await resolveAssignee(order.managerId);
    if (!assigneeId) continue;
    const deferralDays = order.user?.company?.paymentDeferralDays ?? 0;
    const dueDate = new Date(order.shippedAt);
    dueDate.setDate(dueDate.getDate() + deferralDays);
    const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    if (today <= dueDay) continue;

    const overdueDays = Math.floor((today.getTime() - dueDay.getTime()) / (24 * 60 * 60 * 1000));
    const start = today;
    const end = endOfDayFrom(today, 1);

    // One task per order per day.
    const existing = await prisma.task.findFirst({
      where: {
        sourceType: "ORDER",
        sourceId: order.id,
        assigneeId,
        kind: "PROCESSING",
        start: { gte: start, lt: end },
      },
    });
    if (existing) continue;

    await prisma.task.create({
      data: {
        creatorId,
        assigneeId,
        basis: "CUSTOMER_ORDER",
        kind: "PROCESSING",
        type: "INCOMING",
        description: `По заказу ${order.orderNumber} не поступила оплата за отгруженный товар.\nДата отгрузки – ${order.shippedAt.toLocaleDateString("ru-RU")}\nОтсрочка платежа – ${deferralDays} дн.\nПросрочка – ${overdueDays} дн.`,
        sourceType: "ORDER",
        sourceId: order.id,
        sourceNumber: order.orderNumber,
        start,
        end,
        status: "PLANNED",
      },
    });
    created++;
  }
  return created;
}
