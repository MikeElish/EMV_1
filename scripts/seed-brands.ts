import { PrismaClient } from "@prisma/client";
import { brandSlug } from "../src/lib/site";

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: { brand: { not: null } },
    select: { brand: true },
    distinct: ["brand"],
  });

  const names = new Set(
    products
      .map((p) => p.brand?.trim())
      .filter((b): b is string => !!b && b.length > 0)
  );

  const existing = new Set((await prisma.brand.findMany({ select: { name: true } })).map((b) => b.name));

  let created = 0;
  for (const name of names) {
    if (existing.has(name)) continue;
    const slug = brandSlug(name);
    if (!slug) continue;
    const slugConflict = await prisma.brand.findUnique({ where: { slug } });
    if (slugConflict) {
      console.warn(`Skipping "${name}": slug "${slug}" already exists`);
      continue;
    }
    await prisma.brand.create({ data: { name, slug, isActive: true } });
    created++;
  }

  console.log(`Seeded ${created} brands`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
