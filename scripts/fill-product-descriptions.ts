import { prisma } from "@/lib/prisma";

const DRY_RUN = process.argv.includes("--dry-run");

function countOccurrences<T>(items: T[]): Map<T, number> {
  const counts = new Map<T, number>();
  for (const item of items) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  return counts;
}

function pickTemplate(descriptions: string[]): string | null {
  const clean = descriptions
    .map((d) => d.trim())
    .filter((d) => d.length > 0 && !d.startsWith("для техники") && !d.startsWith("Заказать можно"));
  if (clean.length === 0) return null;

  // Prefer informative descriptions: among texts longer than 80 chars pick the most common one.
  const informative = clean.filter((d) => d.length >= 80);
  if (informative.length > 0) {
    const counts = countOccurrences(informative);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }

  // Fallback: the longest description if only short boilerplate texts exist.
  return clean.sort((a, b) => b.length - a.length)[0];
}

async function main() {
  const categories = await prisma.category.findMany({
    include: {
      products: {
        where: { pendingRegistration: false },
        select: { id: true, sku: true, name: true, description: true, noOffer: true },
      },
    },
  });

  const templates = new Map<string, string>();
  const stats: { category: string; template: string | null; samples: number; empty: number }[] = [];

  for (const category of categories) {
    const withDescription = category.products.filter((p) => p.description && p.description.trim().length > 0);
    const template = pickTemplate(withDescription.map((p) => p.description!));
    const empty = category.products.filter((p) => !p.description || p.description.trim().length === 0).length;
    templates.set(category.id, template ?? "");
    stats.push({ category: category.name, template, samples: withDescription.length, empty });
  }

  console.log("Шаблоны описаний по категориям:");
  for (const s of stats) {
    console.log(`\n[${s.category}] samples=${s.samples} empty=${s.empty}`);
    if (s.template) console.log("  ", s.template.slice(0, 200));
    else console.log("  (нет подходящего шаблона)");
  }

  if (DRY_RUN) {
    console.log("\nDry run — ничего не записываем.");
    return;
  }

  let updated = 0;
  const errors: string[] = [];

  for (const category of categories) {
    const template = templates.get(category.id);
    if (!template) continue;

    const toFill = category.products.filter((p) => !p.description || p.description.trim().length === 0);
    for (const product of toFill) {
      try {
        await prisma.product.update({
          where: { id: product.id },
          data: { description: template },
        });
        updated++;
      } catch (e) {
        errors.push(`${product.sku}: ${(e as Error).message}`);
      }
    }
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
