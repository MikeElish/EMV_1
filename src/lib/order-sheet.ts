import { utils, write } from "xlsx";

export type OrderSheetRow = {
  brand: string | null;
  name: string;
  sku: string;
  quantity: number | null;
  deliveryDays: number | null;
  quotedPrice?: number | null;
  currency?: string;
};

export const ORDER_SHEET_HEADERS = ["Бренд", "Наименование", "Артикул", "Количество", "Цена", "Валюта", "Всего", "Срок поставки"];

/**
 * A request to a supplier as .xlsx (base64): «Цена» is left for the supplier,
 * «Всего» = Количество × Цена as a formula. The same columns load back
 * through «Загрузить из Excel» in Проценка.
 */
export function orderSheetBase64(rows: OrderSheetRow[]): string {
  const sheet = utils.aoa_to_sheet([
    ORDER_SHEET_HEADERS,
    ...rows.map((r) => [
      r.brand ?? "",
      r.name,
      r.sku,
      r.quantity ?? "",
      r.quotedPrice == null ? "" : r.quotedPrice / 100,
      r.currency ?? "",
      "",
      r.deliveryDays ?? "",
    ]),
  ]);
  rows.forEach((_, i) => {
    const n = i + 2;
    sheet[`G${n}`] = { t: "n", f: `D${n}*E${n}` };
  });
  sheet["!cols"] = [{ wch: 16 }, { wch: 48 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
  const book = utils.book_new();
  utils.book_append_sheet(book, sheet, "Запрос");
  return write(book, { type: "base64", bookType: "xlsx" });
}

export type SheetResult = { ok: true; base64: string; fileName: string } | { ok: false; error: string };

export type CustomerOrderSheetRow = {
  no: number;
  brand: string | null;
  name: string;
  sku: string | null;
  quantity: number;
  price: number;
  total: number;
  deliveryDate: Date | null;
  quality: string | null;
};

const CUSTOMER_ORDER_SHEET_HEADERS = ["№ п/п", "Бренд", "Наименование", "Артикул", "Количество", "Цена", "Стоимость", "Срок поставки", "Качество"];

/** Customer order lines as .xlsx (base64) for the CRM «Выгрузка» button. */
export function customerOrderSheetBase64(rows: CustomerOrderSheetRow[]): string {
  const sheet = utils.aoa_to_sheet([
    CUSTOMER_ORDER_SHEET_HEADERS,
    ...rows.map((r) => [
      r.no,
      r.brand ?? "",
      r.name,
      r.sku ?? "",
      r.quantity,
      r.price / 100,
      r.total / 100,
      r.deliveryDate ? r.deliveryDate.toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" }) : "",
      r.quality ?? "",
    ]),
  ]);
  sheet["!cols"] = [{ wch: 8 }, { wch: 16 }, { wch: 48 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }];
  const book = utils.book_new();
  utils.book_append_sheet(book, sheet, "Заказ");
  return write(book, { type: "base64", bookType: "xlsx" });
}

export function orderSheetFileName(prefix: string) {
  const date = new Date().toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" });
  return `${prefix} ${date}.xlsx`;
}
