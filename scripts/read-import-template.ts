import ExcelJS from "exceljs";

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
  console.log("Brands in import_template.xlsx:");
  for (const b of [...brands].sort((a, b) => a.localeCompare(b, "ru"))) {
    console.log(b);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
