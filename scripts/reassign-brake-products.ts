import { prisma } from "@/lib/prisma";
import { buildProductSlug } from "@/lib/slug";

const DRY_RUN = process.argv.includes("--dry-run");

const RULES = [
  { keywords: ["колодк"], target: "Фрикционы / Демпферы" },
  { keywords: ["электротормоз"], target: "Электрооборудование / Датчики / Реле" },
  { keywords: ["цилиндр"], target: "Амортизаторы / Гидроцилиндры" },
  { keywords: ["датчик"], target: "Электрооборудование / Датчики / Реле" },
  { keywords: ["трубк"], target: "Патрубки / Шланги / РВД" },
  { keywords: ["трос"], target: "Ремни / Цепи" },
];

function findTarget(name: string): string | null {
  const lower = name.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some((k) => lower.includes(k))) return rule.target;
  }
  return null;
}

async function main() {
  const categories = await prisma.category.findMany();
  const categoryByName = new Map(categories.map((c) => [c.name, c]));
  const sourceCategory = categoryByName.get("Барабаны тормозные");
  if (!sourceCategory) {
    console.log("Категория 'Барабаны тормозные' не найдена");
    return;
  }

  const products = await prisma.product.findMany({
    where: { categoryId: sourceCategory.id, isActive: true },
    select: { id: true, sku: true, name: true, brand: true, categoryId: true },
  });

  const moves: { product: typeof products[number]; target: string; targetId: string }[] = [];
  const stay: typeof products = [];

  for (const product of products) {
    const targetName = findTarget(product.name);
    if (!targetName) {
      stay.push(product);
      continue;
    }
    const targetCategory = categoryByName.get(targetName);
    if (!targetCategory) {
      console.log(`Целевая категория '${targetName}' не найдена для ${product.sku}`);
      stay.push(product);
      continue;
    }
    moves.push({ product, target: targetName, targetId: targetCategory.id });
  }

  console.log(`Всего товаров в 'Барабаны тормозные': ${products.length}`);
  console.log(`Будет перенесено: ${moves.length}`);
  console.log(`Останется: ${stay.length}`);

  for (const m of moves) {
    console.log(`  ${m.product.sku} | ${m.product.name} → ${m.target}`);
  }

  if (DRY_RUN) {
    console.log("\nDry run — ничего не записываем.");
    return;
  }

  let updated = 0;
  const errors: string[] = [];
  for (const m of moves) {
    try {
      await prisma.product.update({
        where: { id: m.product.id },
        data: {
          categoryId: m.targetId,
          slug: buildProductSlug(m.product.brand, m.product.sku),
        },
      });
      updated++;
    } catch (e) {
      errors.push(`${m.product.sku}: ${(e as Error).message}`);
    }
  }

  console.log(`\nПеренесено: ${updated}`);
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
