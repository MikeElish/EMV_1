import "server-only";
import ExcelJS from "exceljs";
import type { SupplierQuoteRow } from "@/lib/supplier-quote";

export async function supplierQuoteWorkbook(rows: SupplierQuoteRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Предложение");
  sheet.columns = [
    { header: "№", width: 6 },
    { header: "Наименование", width: 42 },
    { header: "Артикул", width: 18 },
    { header: "Количество", width: 12 },
    { header: "Цена", width: 12 },
    { header: "Валюта", width: 12 },
    { header: "Всего", width: 14 },
    { header: "Наличие", width: 12 },
    { header: "Количество в наличии", width: 22 },
    { header: "Качество", width: 20 },
    { header: "Склад", width: 36 },
    { header: "Срок поставки (дней)", width: 22 },
    { header: "Статус предложения", width: 24 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  rows.forEach((row, index) => {
    const number = index + 2;
    sheet.addRow([
      index + 1,
      row.name,
      row.sku,
      row.quantity,
      row.price === null ? null : row.price / 100,
      row.currency,
      { formula: `IF(E${number}="","",D${number}*E${number})` },
      row.inStock ? "Да" : null,
      row.stockQuantity,
      row.quality,
      row.warehouse,
      row.deliveryDays ? Number(row.deliveryDays) : null,
      row.noOffer ? "Нет предложения" : null,
    ]);
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
