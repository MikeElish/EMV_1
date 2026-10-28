import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { generateOrderNumber } from "@/lib/order-number-db";
import { aggregateOrderStatus, initialLineStatuses, orderMissingFromSuppliers } from "@/lib/order-status";
import { deliveryMethodFromNote } from "@/lib/delivery";
import { sendPriceRequests } from "@/lib/price-requests";
import { applyOrderSurcharges } from "@/lib/order-surcharge";
import { manualOrderSchema, type ManualOrderInput } from "@/lib/validators/manual-order";

export type ManualOrderResult = { ok: true; orderNumber: string } | { ok: false; error: string };

/**
 * «Новый заказ» of the staff: the order window and the Claude connector
 * (src/lib/mcp) both end here, after checking who may do it.
 */
export async function createManualOrderRecord(input: ManualOrderInput, creatorId: string | null = null): Promise<ManualOrderResult> {
  const parsed = manualOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }
  const { customerId, companyId, customerName, customerPhone, customerEmail, deliveryNote, items } = parsed.data;

  let deferred = false;
  // Отчёты → Бонусы: the client company's manager, else whoever makes it.
  let managerId = creatorId;
  if (customerId) {
    const customer = await prisma.user.findUnique({
      where: { id: customerId },
      select: { role: true, company: { select: { paymentType: true, managerId: true } } },
    });
    if (customer?.role !== "CUSTOMER") return { ok: false, error: "Покупатель не найден" };
    deferred = customer.company?.paymentType === "DEFERRED";
    managerId = customer.company?.managerId ?? managerId;
  } else if (companyId) {
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { paymentType: true, managerId: true } });
    if (!company) return { ok: false, error: "Компания не найдена" };
    deferred = company.paymentType === "DEFERRED";
    managerId = company.managerId ?? managerId;
  }

  const productIds = [...new Set(items.map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true },
  });
  if (products.length !== productIds.length) {
    return { ok: false, error: "Часть товаров не найдена — обновите окно заказа" };
  }
  const nameById = new Map(products.map((p) => [p.id, p.name]));

  const statuses = await initialLineStatuses(items, deferred);
  const orderNumber = await generateOrderNumber();
  const created = await prisma.order.create({
    data: {
      orderNumber,
      customerName,
      customerPhone,
      customerEmail,
      deliveryNote: deliveryNote || null,
      totalAmount: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      userId: customerId || null,
      managerId,
      deferred,
      status: aggregateOrderStatus(statuses),
      items: {
        create: items.map((i, index) => ({
          productId: i.productId,
          nameSnapshot: nameById.get(i.productId)!,
          priceSnapshot: i.price,
          quantity: i.quantity,
          status: statuses[index],
          deferred,
          deliveryMethod: deliveryMethodFromNote(deliveryNote),
        })),
      },
    },
  });

  await orderMissingFromSuppliers(created.id);
  await applyOrderSurcharges(created.id);
  void sendPriceRequests(created.id).catch((error) => console.error("[price-requests] order", orderNumber, error));
  revalidatePath("/admin/crm/orders");
  revalidatePath("/admin/crm/supplier-orders");
  revalidatePath("/shop/orders");
  return { ok: true, orderNumber };
}
