"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-dal";
import { categorySchema, type CategoryInput } from "@/lib/validators/category";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createCategory(input: CategoryInput): Promise<ActionResult> {
  await verifyAdminSession();

  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  const existing = await prisma.category.findUnique({
    where: { slug: parsed.data.slug },
  });
  if (existing) {
    return { ok: false, error: "Категория с таким slug уже существует" };
  }

  await prisma.category.create({ data: parsed.data });
  revalidatePath("/admin/crm/categories");
  revalidatePath("/shop");
  revalidatePath("/shop/cart");
  redirect("/admin/crm/categories");
}

export async function updateCategory(
  id: string,
  input: CategoryInput
): Promise<ActionResult> {
  await verifyAdminSession();

  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  const conflict = await prisma.category.findFirst({
    where: { slug: parsed.data.slug, NOT: { id } },
  });
  if (conflict) {
    return { ok: false, error: "Категория с таким slug уже существует" };
  }

  await prisma.category.update({ where: { id }, data: parsed.data });
  revalidatePath("/admin/crm/categories");
  revalidatePath("/shop");
  revalidatePath("/shop/cart");
  return { ok: true };
}

export type CategoryActiveResult =
  | { ok: true; products: number; skipped: number }
  | { ok: false; error: string };

/**
 * Shows / hides a category in the shop together with everything in it:
 * its sub-categories and all their products. Products without a price (e.g.
 * fresh from 1С) can't go on sale and stay inactive -- they're counted in
 * `skipped`.
 */
export async function setCategoryActive(id: string, isActive: boolean): Promise<CategoryActiveResult> {
  await verifyAdminSession();

  const all = await prisma.category.findMany({ select: { id: true, parentId: true } });
  if (!all.some((c) => c.id === id)) return { ok: false, error: "Категория не найдена" };
  const ids = [id];
  for (let i = 0; i < ids.length; i++) {
    for (const c of all) if (c.parentId === ids[i]) ids.push(c.id);
  }

  const [, switched, skipped] = await prisma.$transaction([
    prisma.category.updateMany({ where: { id: { in: ids } }, data: { isActive } }),
    prisma.product.updateMany({
      where: { categoryId: { in: ids }, ...(isActive ? { price: { gt: 0 } } : {}) },
      data: { isActive },
    }),
    prisma.product.count({ where: { categoryId: { in: ids }, ...(isActive ? { price: { lte: 0 } } : { id: "" }) } }),
  ]);

  revalidatePath("/admin/crm/categories");
  revalidatePath("/admin/crm/products");
  revalidatePath("/shop", "layout");
  return { ok: true, products: switched.count, skipped };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  await verifyAdminSession();

  const productCount = await prisma.product.count({ where: { categoryId: id } });
  if (productCount > 0) {
    return {
      ok: false,
      error: "Нельзя удалить категорию, в которой есть товары",
    };
  }

  await prisma.category.delete({ where: { id } });
  revalidatePath("/admin/crm/categories");
  revalidatePath("/shop");
  revalidatePath("/shop/cart");
  return { ok: true };
}
