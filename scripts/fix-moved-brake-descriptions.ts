import { prisma } from "@/lib/prisma";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const sourceCategory = await prisma.category.findFirst({ where: { name: "Барабаны тормозные" } });
  if (!sourceCategory) {
    console.log("Категория 'Барабаны тормозные' не найдена");
    return;
  }

  // Old template picked for "Барабаны тормозные" before products were moved.
  const oldTemplate =
    "Безопасность техники начинается с тормозов. Барабан отличного качества сохраняет геометрию под нагрузкой и служит долго даже при интенсивной работе. Прямые поставки без посредников позволяют держать цены на разумном уровне.";

  const movedProducts = await prisma.product.findMany({
    where: {
      categoryId: { not: sourceCategory.id },
      description: oldTemplate,
    },
    select: { id: true, sku: true, name: true, categoryId: true, description: true },
  });

  const categories = await prisma.category.findMany();
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  // Build templates per category the same way as fill-product-descriptions.ts.
  function pickTemplate(descriptions: string[]): string | null {
    const clean = descriptions
      .map((d) => d.trim())
      .filter((d) => d.length > 0 && !d.startsWith("для техники") && !d.startsWith("Заказать можно"));
    if (clean.length === 0) return null;
    const informative = clean.filter((d) => d.length >= 80);
    if (informative.length > 0) {
      const counts = new Map<string, number>();
      for (const d of informative) counts.set(d, (counts.get(d) ?? 0) + 1);
      return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    }
    return clean.sort((a, b) => b.length - a.length)[0];
  }

  const templates = new Map<string, string>();
  for (const category of categories) {
    const products = await prisma.product.findMany({
      where: { categoryId: category.id, pendingRegistration: false },
      select: { description: true },
    });
    const withDesc = products.map((p) => p.description).filter((d): d is string => !!d);
    const template = pickTemplate(withDesc);
    if (template) templates.set(category.id, template);
  }

  console.log(`Найдено перенесённых товаров со старым описанием: ${movedProducts.length}`);

  let updated = 0;
  const errors: string[] = [];

  for (const product of movedProducts) {
    const template = templates.get(product.categoryId);
    if (!template) continue;
    const category = categoryById.get(product.categoryId);
    console.log(`  ${product.sku} | ${product.name} → ${category?.name}`);

    if (DRY_RUN) continue;

    try {
      await prisma.product.update({ where: { id: product.id }, data: { description: template } });
      updated++;
    } catch (e) {
      errors.push(`${product.sku}: ${(e as Error).message}`);
    }
  }

  if (DRY_RUN) {
    console.log("\nDry run — ничего не записываем.");
    return;
  }

  console.log(`\nОбновлено описаний: ${updated}`);
  if (errors.length > 0) {
    console.log("Ошибки:");
    errors.forEach((e) => console.log("  -", e));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
