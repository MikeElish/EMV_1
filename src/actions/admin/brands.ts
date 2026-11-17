"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { accessDenied } from "@/lib/access-server";
import { brandSchema, type BrandInput } from "@/lib/validators/brand";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createBrand(input: BrandInput): Promise<ActionResult> {
  const denied = await accessDenied("crm.brands");
  if (denied) return denied;

  const parsed = brandSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  const existing = await prisma.brand.findFirst({
    where: { OR: [{ slug: parsed.data.slug }, { name: parsed.data.name }] },
  });
  if (existing) {
    return { ok: false, error: "Бренд с таким названием или slug уже существует" };
  }

  await prisma.brand.create({ data: parsed.data });
  revalidatePath("/admin/crm/brands");
  revalidatePath("/shop");
  revalidatePath("/shop/brands");
  redirect("/admin/crm/brands");
}

export async function updateBrand(id: string, input: BrandInput): Promise<ActionResult> {
  const denied = await accessDenied("crm.brands");
  if (denied) return denied;

  const parsed = brandSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  const current = await prisma.brand.findUnique({ where: { id } });
  if (!current) return { ok: false, error: "Бренд не найден" };

  const conflict = await prisma.brand.findFirst({
    where: {
      OR: [{ slug: parsed.data.slug }, { name: parsed.data.name }],
      NOT: { id },
    },
  });
  if (conflict) {
    return { ok: false, error: "Бренд с таким названием или slug уже существует" };
  }

  await prisma.$transaction([
    prisma.brand.update({ where: { id }, data: parsed.data }),
    // Keep Product.brand in sync when the canonical name changes.
    ...(current.name !== parsed.data.name
      ? [prisma.product.updateMany({ where: { brand: current.name }, data: { brand: parsed.data.name } })]
      : []),
  ]);

  revalidatePath("/admin/crm/brands");
  revalidatePath("/shop");
  revalidatePath("/shop/brands");
  return { ok: true };
}

export async function deleteBrand(id: string): Promise<ActionResult> {
  const denied = await accessDenied("crm.brands");
  if (denied) return denied;

  const brand = await prisma.brand.findUnique({ where: { id } });
  if (!brand) return { ok: false, error: "Бренд не найден" };

  const productCount = await prisma.product.count({ where: { brand: brand.name } });
  if (productCount > 0) {
    return { ok: false, error: "Нельзя удалить бренд, у которого есть товары" };
  }

  await prisma.brand.delete({ where: { id } });
  revalidatePath("/admin/crm/brands");
  revalidatePath("/shop");
  revalidatePath("/shop/brands");
  return { ok: true };
}

export async function setBrandActive(id: string, isActive: boolean): Promise<ActionResult> {
  const denied = await accessDenied("crm.brands");
  if (denied) return denied;

  await prisma.brand.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/crm/brands");
  revalidatePath("/shop");
  revalidatePath("/shop/brands");
  return { ok: true };
}

