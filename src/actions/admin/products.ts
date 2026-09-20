"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-dal";
import { productSchema, type ProductInput } from "@/lib/validators/product";

export type ActionResult = { ok: true } | { ok: false; error: string };

function toProductData(data: ProductInput) {
  const attributes: Prisma.InputJsonObject = {
    ...(data.machineType ? { machineType: data.machineType } : {}),
    ...(data.compatibleWith.length > 0
      ? { compatibleWith: data.compatibleWith }
      : {}),
  };

  return {
    sku: data.sku,
    name: data.name,
    slug: data.slug,
    description: data.description,
    price: data.price,
    stock: data.stock,
    categoryId: data.categoryId,
    group: data.group,
    brand: data.brand,
    images: data.images,
    isActive: data.isActive,
    attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
  };
}

export async function createProduct(input: ProductInput): Promise<ActionResult> {
  await verifyAdminSession();

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  const existing = await prisma.product.findFirst({
    where: { OR: [{ sku: parsed.data.sku }, { slug: parsed.data.slug }] },
  });
  if (existing) {
    return { ok: false, error: "Товар с таким артикулом или slug уже существует" };
  }

  await prisma.product.create({ data: toProductData(parsed.data) });

  revalidatePath("/admin/crm/products");
  revalidatePath("/shop");
  redirect("/admin/crm/products");
}

export async function updateProduct(
  id: string,
  input: ProductInput
): Promise<ActionResult> {
  await verifyAdminSession();

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  const conflict = await prisma.product.findFirst({
    where: {
      OR: [{ sku: parsed.data.sku }, { slug: parsed.data.slug }],
      NOT: { id },
    },
  });
  if (conflict) {
    return { ok: false, error: "Товар с таким артикулом или slug уже существует" };
  }

  const current = await prisma.product.findUnique({ where: { id }, select: { stock: true } });
  const restocked = current !== null && parsed.data.stock > current.stock;

  await prisma.product.update({
    where: { id },
    data: {
      ...toProductData(parsed.data),
      ...(restocked ? { newArrivalAt: new Date() } : {}),
    },
  });

  revalidatePath("/admin/crm/products");
  revalidatePath("/shop");
  redirect("/admin/crm/products");
}

export async function toggleProductActive(
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  await verifyAdminSession();
  await prisma.product.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/crm/products");
  revalidatePath("/shop");
  return { ok: true };
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  await verifyAdminSession();

  const orderItemCount = await prisma.orderItem.count({ where: { productId: id } });
  if (orderItemCount > 0) {
    return {
      ok: false,
      error: "Нельзя удалить товар, по которому есть заказы. Деактивируйте его вместо удаления.",
    };
  }

  await prisma.product.delete({ where: { id } });
  revalidatePath("/admin/crm/products");
  revalidatePath("/shop");
  return { ok: true };
}
