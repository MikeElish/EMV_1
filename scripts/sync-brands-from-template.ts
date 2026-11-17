import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";
import { brandSlug } from "../src/lib/site";

const prisma = new PrismaClient();

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile("import_template.xlsx");
  const sheet = workbook.worksheets[0];
  const fileBrands = new Set<string>();
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const brand = row.getCell(1).value?.toString().trim();
    if (brand) fileBrands.add(brand);
  });

  const existing = await prisma.brand.findMany({ select: { name: true } });
  const existingNames = new Set(existing.map((b) => b.name));

  const missing = [...fileBrands].filter((b) => !existingNames.has(b)).sort((a, b) => a.localeCompare(b, "ru"));
  console.log(`File brands: ${fileBrands.size}`);
  console.log(`Existing brands: ${existingNames.size}`);
  console.log(`Missing brands: ${missing.length}`);

  if (missing.length === 0) {
    console.log("All brands already exist");
    return;
  }

  let created = 0;
  for (const name of missing) {
    const slug = brandSlug(name);
    if (!slug) {
      console.warn(`Skipping "${name}": empty slug`);
      continue;
    }
    const conflict = await prisma.brand.findFirst({ where: { OR: [{ name }, { slug }] } });
    if (conflict) {
      console.warn(`Skipping "${name}": conflict with existing ${conflict.name} / ${conflict.slug}`);
      continue;
    }
    await prisma.brand.create({ data: { name, slug, isActive: true } });
    created++;
    console.log(`Created: ${name} (${slug})`);
  }
  console.log(`Created ${created} brands`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
