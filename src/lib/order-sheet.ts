import { utils, write } from "xlsx";

export type OrderSheetRow = {
  brand: string | null;
  name: string;
  sku: string;
  quantity: number | null;
  deliveryDays: number | null;
};

export const ORDER_SHEET_HEADERS = ["Бренд", "Наименование", "Артикул", "Количество", "Цена", "Всего", "Срок поставки"];

/**
 * A request to a supplier as .xlsx (base64): «Цена» is left for the supplier,
 * «Всего» = Количество × Цена as a formula. The same columns load back
 * through «Загрузить из Excel» in Проценка.
 */
export function orderSheetBase64(rows: OrderSheetRow[]): string {
  const sheet = utils.aoa_to_sheet([
    ORDER_SHEET_HEADERS,
    ...rows.map((r) => [r.brand ?? "", r.name, r.sku, r.quantity ?? "", "", "", r.deliveryDays ?? ""]),
  ]);
  rows.forEach((_, i) => {
    const n = i + 2;
    sheet[`F${n}`] = { t: "n", f: `D${n}*E${n}` };
  });
  sheet["!cols"] = [{ wch: 16 }, { wch: 48 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
  const book = utils.book_new();
  utils.book_append_sheet(book, sheet, "Запрос");
  return write(book, { type: "base64", bookType: "xlsx" });
}

export function orderSheetFileName(prefix: string) {
  const date = new Date().toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" });
  return `${prefix} ${date}.xlsx`;
}
