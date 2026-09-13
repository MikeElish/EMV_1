import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const categories = [
  { name: "Гидравлика", slug: "gidravlika" },
  { name: "Двигатель", slug: "dvigatel" },
  { name: "Ходовая часть", slug: "hodovaya-chast" },
  { name: "Электрика", slug: "elektrika" },
  { name: "Фильтры", slug: "filtry" },
];

const brands = ["CAT", "Komatsu", "JCB", "Hitachi", "Volvo CE"];
const machineTypes = ["Экскаватор", "Погрузчик", "Бульдозер", "Кран", "Трактор"];

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

async function main() {
  await prisma.category.createMany({
    data: categories,
    skipDuplicates: true,
  });

  const createdCategories = await prisma.category.findMany();

  for (let i = 1; i <= 40; i++) {
    const category = pick(createdCategories, i);
    const brand = pick(brands, i + 1);
    const machineType = pick(machineTypes, i + 2);
    const sku = `EMV-${String(i).padStart(4, "0")}`;

    await prisma.product.upsert({
      where: { sku },
      update: {},
      create: {
        sku,
        name: `${category.name}: деталь №${i} (${brand})`,
        slug: `${category.slug}-${i}`,
        description: `Запчасть для ${machineType.toLowerCase()}ов ${brand}. Совместима с распространёнными моделями данного типа техники.`,
        price: 1500_00 + i * 137_00,
        stock: i % 7 === 0 ? 0 : (i % 5) + 1,
        images: [],
        categoryId: category.id,
        brand,
        attributes: {
          machineType,
          compatibleWith: [`${brand} ${100 + i}`],
        },
        isActive: true,
      },
    });
  }

  console.log("Сиды загружены: категории —", createdCategories.length, ", товары — 40");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
