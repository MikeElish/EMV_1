import ExcelJS from "exceljs";
import { writeFileSync } from "fs";

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile("import_template.xlsx");
  const sheet = workbook.worksheets[0];
  const brands = new Set<string>();
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const brand = row.getCell(1).value?.toString().trim();
    if (brand) brands.add(brand);
  });

  const sorted = [...brands].sort((a, b) => a.localeCompare(b, "ru"));
  const lines = sorted.map((b) => `  ${JSON.stringify(b)},`).join("\n");

  const content = `// Canonical brand list for spec-equipment/parts, auto-generated from import_template.xlsx\nexport const BRANDS: string[] = [\n${lines}\n];\n`;

  writeFileSync("src/content/brands.ts", content, "utf-8");
  console.log(`Generated src/content/brands.ts with ${sorted.length} brands`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
