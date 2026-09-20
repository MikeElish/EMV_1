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
  redirect("/admin/crm/categories");
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
  return { ok: true };
}
