import "server-only";
import path from "path";
import { existsSync } from "fs";
import PDFDocument from "pdfkit";
import { rublesInWords } from "@/lib/money-words";

// «Счет на оплату» as the template the shop prints from 1С (Счета/Счет на
// оплату № 498 …xlsx): bank block with the logo, parties, lines, totals, the
// terms and the signature with the stamp. Amounts in kopecks.

const FONT = path.join(process.cwd(), "assets", "fonts", "PTSans-Regular.ttf");
const FONT_BOLD = path.join(process.cwd(), "assets", "fonts", "PTSans-Bold.ttf");
const LOGO = path.join(process.cwd(), "assets", "invoice-logo.png");
// Kept off git and off the public folder: copied to the server by hand.
const STAMP = path.join(process.cwd(), "private", "invoice", "stamp.png");
const SIGNATURE = path.join(process.cwd(), "private", "invoice", "signature.png");

export const SELLER = {
  bank: 'ООО "Банк Точка" г. Москва',
  bik: "044525104",
  correspondent: "30101810745374525104",
  account: "40802810020000899310",
  inn: "222330730938",
  name: "Елишев Михаил Владимирович (ИП)",
  details: "Елишев Михаил Владимирович (ИП),  ИНН 222330730938,  190020, Город Санкт-Петербург, Нарвский пр-кт, д. 16, кв. 33,  тел.: +7-981-039-77-72",
  signer: "Елишев М. В.",
  signerTitle: "Предприниматель",
};

export type InvoiceLine = { sku: string; name: string; quantity: number; unit: string; price: number; sum: number };
export type InvoiceData = {
  number: string;
  /** «21 сентября 2026 г.» */
  dateText: string;
  buyer: string;
  basis: string;
  lines: InvoiceLine[];
  vatRate: number | null;
  vat: number;
  total: number;
  /** The numbered terms under the table. */
  terms: string[];
};

const money = (kopecks: number) =>
  (kopecks / 100).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/ /g, " ");
const qty = (n: number) => n.toLocaleString("ru-RU", { maximumFractionDigits: 3 });

export function renderInvoicePdf(data: InvoiceData): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margins: { top: 28, bottom: 28, left: 34, right: 28 } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  doc.registerFont("r", FONT);
  doc.registerFont("b", FONT_BOLD);
  const L = doc.page.margins.left;
  const R = doc.page.width - doc.page.margins.right;
  const W = R - L;
  const line = (x1: number, y1: number, x2: number, y2: number, width = 0.6) =>
    doc.lineWidth(width).moveTo(x1, y1).lineTo(x2, y2).stroke();
  const text = (s: string, x: number, y: number, opts: PDFKit.Mixins.TextOptions & { font?: string; size?: number } = {}) => {
    doc.font(opts.font ?? "r").fontSize(opts.size ?? 9).text(s, x, y, { lineGap: 0.5, ...opts });
  };

  // ---- Bank block -----------------------------------------------------------
  let y = 34;
  if (existsSync(LOGO)) doc.image(LOGO, L, y - 6, { fit: [78, 72] });
  const bx = L + 92;
  const c1 = bx + 238;
  const c2 = c1 + 44;
  const rowH = 15;
  doc.lineWidth(0.6).rect(bx, y, R - bx, rowH * 6).stroke();
  line(bx, y + rowH * 3, R, y + rowH * 3);
  line(c1, y, c1, y + rowH * 6);
  line(c2, y, c2, y + rowH * 6);
  line(c1, y + rowH, c2 + 0, y + rowH);
  line(c2, y + rowH * 1, R, y + rowH * 1);
  line(bx, y + rowH * 4, c1, y + rowH * 4);
  line(bx + 116, y + rowH * 3, bx + 116, y + rowH * 4);
  text(SELLER.bank, bx + 3, y + 3, { width: 232 });
  text("Банк получателя", bx + 3, y + rowH * 2 + 4, { size: 7.5 });
  text("БИК", c1 + 3, y + 3);
  text(SELLER.bik, c2 + 3, y + 3);
  text("Сч. №", c1 + 3, y + rowH + 3);
  text(SELLER.correspondent, c2 + 3, y + rowH + 3);
  text(`ИНН  ${SELLER.inn}`, bx + 3, y + rowH * 3 + 3);
  text("КПП", bx + 119, y + rowH * 3 + 3);
  text("Сч. №", c1 + 3, y + rowH * 3 + 3);
  text(SELLER.account, c2 + 3, y + rowH * 3 + 3);
  text(SELLER.name, bx + 3, y + rowH * 4 + 3, { width: 232 });
  text("Получатель", bx + 3, y + rowH * 5 + 4, { size: 7.5 });

  // ---- Title and parties ------------------------------------------------------
  y += rowH * 6 + 22;
  text(`Счет на оплату № ${data.number} от ${data.dateText}`, L, y, { font: "b", size: 14 });
  y = doc.y + 4;
  line(L, y, R, y, 1.8);
  y += 8;
  const party = (label: string, sub: string, value: string) => {
    text(label, L, y, { width: 70 });
    text(sub, L, doc.y, { width: 70 });
    const after = doc.y;
    text(value, L + 74, y, { font: "b", width: W - 74 });
    y = Math.max(after, doc.y) + 6;
  };
  party("Поставщик", "(исполнитель):", SELLER.details);
  party("Покупатель", "(заказчик):", data.buyer);
  text("Основание:", L, y, { width: 70 });
  text(data.basis, L + 74, y, { font: "b", width: W - 74 });
  y = doc.y + 10;

  // ---- Lines ----------------------------------------------------------------
  const cols = [
    { title: "№", w: 22, align: "center" as const },
    { title: "Артикул", w: 76, align: "left" as const },
    { title: "Товар (Услуга)", w: 0, align: "left" as const },
    { title: "Кол-во", w: 44, align: "right" as const },
    { title: "Ед.", w: 30, align: "left" as const },
    { title: "Цена", w: 66, align: "right" as const },
    { title: "Сумма", w: 72, align: "right" as const },
  ];
  cols[2].w = W - cols.reduce((s, c) => s + c.w, 0);
  const xs = cols.reduce<number[]>((acc, c, i) => [...acc, i ? acc[i - 1] + cols[i - 1].w : L], []);
  const tableRow = (cells: string[], bold: boolean) => {
    doc.font(bold ? "b" : "r").fontSize(8.5);
    const h = Math.max(...cells.map((c, i) => doc.heightOfString(c, { width: cols[i].w - 6 }))) + 6;
    if (y + h > doc.page.height - doc.page.margins.bottom - 20) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    doc.lineWidth(0.6).rect(L, y, W, h).stroke();
    cells.forEach((c, i) => {
      if (i) line(xs[i], y, xs[i], y + h);
      doc.text(c, xs[i] + 3, y + 3, { width: cols[i].w - 6, align: bold ? "center" : cols[i].align });
    });
    y += h;
  };
  doc.lineWidth(1.4).rect(L, y, W, 0).stroke();
  tableRow(cols.map((c) => c.title), true);
  data.lines.forEach((l, i) => tableRow([String(i + 1), l.sku, l.name, qty(l.quantity), l.unit, money(l.price), money(l.sum)], false));

  // ---- Totals ---------------------------------------------------------------
  y += 6;
  const totalRow = (label: string, value: string) => {
    text(label, L, y, { font: "b", width: W - 80, align: "right" });
    text(value, R - 76, y, { font: "b", width: 76, align: "right" });
    y += 13;
  };
  totalRow("Итого:", money(data.total));
  totalRow(data.vatRate ? `В том числе НДС ${data.vatRate}%:` : "Без налога (НДС)", data.vatRate ? money(data.vat) : "-");
  totalRow("Всего к оплате:", money(data.total));
  y += 4;
  const count = data.lines.length;
  text(`Всего наименований ${count}, на сумму ${money(data.total)} руб.`, L, y);
  text(rublesInWords(data.total), L, doc.y + 1, { font: "b" });
  y = doc.y + 4;
  line(L, y, R, y, 1.8);
  y += 6;

  // ---- Terms ----------------------------------------------------------------
  doc.font("r").fontSize(7.5);
  for (const t of [
    "Оплата данного счета означает согласие с условиями поставки товара.",
    "Если иное не предусмотрено Договором, а также дополнительными соглашениями и спецификациями к нему, Стороны приняли следующие условия поставки:",
    ...data.terms,
  ]) {
    if (y + doc.heightOfString(t, { width: W }) > doc.page.height - doc.page.margins.bottom - 90) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    doc.text(t, L, y, { width: W, align: "justify", lineGap: 0.3 });
    y = doc.y + 1.5;
  }

  // ---- Signature --------------------------------------------------------------
  y += 26;
  if (y + 90 > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
    y = doc.page.margins.top + 20;
  }
  text(SELLER.signerTitle, L, y, { font: "b" });
  line(L + 90, y + 11, L + 220, y + 11);
  line(L + 232, y + 11, L + 340, y + 11);
  text(SELLER.signer, L + 236, y + 1);
  text("подпись", L + 90, y + 13, { width: 130, align: "center", size: 7 });
  text("расшифровка подписи", L + 232, y + 13, { width: 108, align: "center", size: 7 });
  if (existsSync(SIGNATURE)) doc.image(SIGNATURE, L + 104, y - 22, { fit: [104, 56] });
  text("М.П.", L + 170, y + 40);
  if (existsSync(STAMP)) doc.image(STAMP, L + 196, y + 26, { fit: [104, 104] });

  doc.end();
  return done;
}
