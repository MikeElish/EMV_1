"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { accessDenied } from "@/lib/access-server";
import { loadOneCServices, type OneCService } from "@/lib/onec-sync";
import { OneCError } from "@/lib/onec";

export type ActionResult = { ok: true } | { ok: false; error: string };

const serviceSchema = z.object({
  name: z.string().trim().min(2, "Укажите наименование").max(300),
  code: z.string().trim().max(60).optional(),
  unit: z.string().trim().max(30).optional(),
  price: z.number().int().min(0, "Цена не может быть отрицательной"),
  description: z.string().trim().max(2000).optional(),
  isActive: z.boolean(),
});

export type ServiceInput = z.infer<typeof serviceSchema>;

async function codeTaken(code: string | undefined, exceptId?: string) {
  if (!code) return false;
  const other = await prisma.service.findUnique({ where: { code } });
  return !!other && other.id !== exceptId;
}

function toData(data: ServiceInput) {
  return {
    name: data.name,
    code: data.code || null,
    unit: data.unit || null,
    price: data.price,
    description: data.description || null,
    isActive: data.isActive,
  };
}

export async function saveService(id: string | null, input: ServiceInput): Promise<ActionResult> {
  const denied = await accessDenied("crm.services");
  if (denied) return denied;
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  if (await codeTaken(parsed.data.code, id ?? undefined)) {
    return { ok: false, error: "Услуга с таким кодом уже есть" };
  }
  if (id) await prisma.service.update({ where: { id }, data: toData(parsed.data) });
  else await prisma.service.create({ data: toData(parsed.data) });
  revalidatePath("/admin/crm/services");
  return { ok: true };
}

export async function toggleServiceActive(id: string, isActive: boolean): Promise<ActionResult> {
  const denied = await accessDenied("crm.services");
  if (denied) return denied;
  await prisma.service.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/crm/services");
  return { ok: true };
}

export async function deleteService(id: string): Promise<ActionResult> {
  const denied = await accessDenied("crm.services");
  if (denied) return denied;
  const used = await prisma.extraCost.count({ where: { serviceId: id } });
  if (used) return { ok: false, error: "Услуга есть в доп.расходах — деактивируйте её вместо удаления." };
  await prisma.service.delete({ where: { id } });
  revalidatePath("/admin/crm/services");
  return { ok: true };
}

export type OneCServicesResult =
  | { ok: true; services: (OneCService & { added: boolean })[] }
  | { ok: false; error: string };

/** Services from 1С:Бухгалтерия, marking those already on the site. */
export async function listOneCServices(): Promise<OneCServicesResult> {
  const denied = await accessDenied("crm.services", "view");
  if (denied) return denied;
  try {
    const [services, linked] = await Promise.all([
      loadOneCServices(),
      prisma.service.findMany({ where: { oneCRef: { not: null } }, select: { oneCRef: true } }),
    ]);
    const added = new Set(linked.map((s) => s.oneCRef));
    return { ok: true, services: services.map((s) => ({ ...s, added: added.has(s.ref) })) };
  } catch (error) {
    return { ok: false, error: error instanceof OneCError ? error.message : "Не удалось получить услуги из 1С" };
  }
}

/** Copies one 1С service card to the site (price 0 -- set it in the card). */
export async function importOneCService(ref: string): Promise<ActionResult> {
  const denied = await accessDenied("crm.services");
  if (denied) return denied;
  if (await prisma.service.findUnique({ where: { oneCRef: ref } })) return { ok: true };
  let card: OneCService | undefined;
  try {
    card = (await loadOneCServices()).find((s) => s.ref === ref);
  } catch (error) {
    return { ok: false, error: error instanceof OneCError ? error.message : "1С не отвечает" };
  }
  if (!card) return { ok: false, error: "Услуга в 1С не найдена" };
  const code = card.code && !(await codeTaken(card.code)) ? card.code : null;
  await prisma.service.create({
    data: { name: card.name, code, unit: card.unit || null, price: 0, oneCRef: card.ref, isActive: true },
  });
  revalidatePath("/admin/crm/services");
  return { ok: true };
}
