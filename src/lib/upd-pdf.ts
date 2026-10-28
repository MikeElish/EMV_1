import "server-only";
import { existsSync } from "fs";
import PDFDocument from "pdfkit";
import { FONT, FONT_BOLD, SELLER, SIGNATURE, STAMP } from "@/lib/invoice-pdf";

// «Универсальный передаточный документ», статус 1 (счёт-фактура и
// передаточный документ), as the form of постановление № 1137 that 1С
// prints: header (1)–(8), the goods table, the signatures and the transfer
// part [8]–[19]. Amounts in kopecks.

export type UpdLine = {
  sku: string;
  name: string;
  quantity: number;
  /** with VAT, per unit */
  price: number;
  vat: number;
};

export type UpdData = {
  /** The Счет-фактура's number. */
  number: string;
  /** «27 октября 2026 г.» */
  dateText: string;
  /** dd.mm.yyyy */
  date: string;
  /** The Реализация's number: «Документ об отгрузке». */
  shipmentNumber: string;
  buyer: { name: string; address: string; inn: string; kpp: string };
  consignee: string;
  payments: string;
  basis: string;
  transport: string;
  /** percent, null -- без НДС */
  vatRate: number | null;
  lines: UpdLine[];
};

const money = (kopecks: number) =>
  (kopecks / 100).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/ /g, " ");
const qty = (n: number) => n.toLocaleString("ru-RU", { maximumFractionDigits: 3 });

// Goods table: [label, width, column number].
const COLUMNS: [string, number, string][] = [
  ["Код товара/ работ, услуг", 50, "А"],
  ["№ п/п", 22, "1"],
  ["Наименование товара (описание выполненных работ, оказанных услуг), имущественного права", 182, "1а"],
  ["Код вида товара", 30, "1б"],
  ["Единица измерения: код", 28, "2"],
  ["условное обозначение (национальное)", 34, "2а"],
  ["Количество (объем)", 38, "3"],
  ["Цена (тариф) за единицу измерения", 55, "4"],
  ["Стоимость товаров (работ, услуг), имущественных прав без налога - всего", 62, "5"],
  ["В том числе сумма акциза", 36, "6"],
  ["Налоговая ставка", 34, "7"],
  ["Сумма налога, предъявляемая покупателю", 52, "8"],
  ["Стоимость товаров (работ, услуг), имущественных прав с налогом - всего", 62, "9"],
  ["Страна происхождения товара: цифровой код", 32, "10"],
  ["краткое наименование", 38, "10а"],
  ["Регистрационный номер декларации на товары или регистрационный номер партии товара, подлежащего прослеживаемости", 47, "11"],
];

export function renderUpdPdf(data: UpdData): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margins: { top: 18, bottom: 18, left: 20, right: 20 } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
  doc.registerFont("r", FONT);
  doc.registerFont("b", FONT_BOLD);

  const L = doc.page.margins.left;
  const R = doc.page.width - doc.page.margins.right;
  const BOTTOM = doc.page.height - doc.page.margins.bottom;
  const SIDE = L + 112; // the right of the status column
  const line = (x1: number, y1: number, x2: number, y2: number, w = 0.5) => doc.lineWidth(w).moveTo(x1, y1).lineTo(x2, y2).stroke();
  const text = (s: string, x: number, y: number, o: PDFKit.Mixins.TextOptions & { font?: string; size?: number } = {}) =>
    doc.font(o.font ?? "r").fontSize(o.size ?? 7).text(s, x, y, { lineGap: 0, ...o });
  const height = (s: string, width: number, size = 7, font = "r") => doc.font(font).fontSize(size).heightOfString(s, { width, lineGap: 0 });

  const vatLabel = data.vatRate ? `${data.vatRate}%` : "без НДС";
  const rows = data.lines.map((l) => {
    const sum = l.price * l.quantity;
    return { ...l, sum, noVat: sum - l.vat, unitNoVat: Math.round((sum - l.vat) / l.quantity) };
  });
  const total = rows.reduce((s, r) => s + r.sum, 0);
  const totalVat = rows.reduce((s, r) => s + r.vat, 0);

  // ---- Header -----------------------------------------------------------------
  let y = 18;
  text("Приложение № 1 к постановлению Правительства Российской Федерации от 26 декабря 2011 г. № 1137 (в редакции постановления Правительства Российской Федерации от 16 августа 2024 г. № 1096)", R - 300, y, { width: 300, size: 5.5, align: "right" });
  y = 34;
  text("Универсальный передаточный документ", L, y, { width: 100, font: "b", size: 9 });
  text("Статус:", L, y + 34, { size: 7 });
  doc.lineWidth(0.8).rect(L + 30, y + 30, 18, 14).stroke();
  text("1", L + 30, y + 33, { width: 18, align: "center", font: "b", size: 9 });
  text("1 – счет-фактура и передаточный документ (акт)\n2 – передаточный документ (акт)", L, y + 50, { width: 104, size: 5.5 });
  line(SIDE, y - 4, SIDE, y + 168, 0.8);

  const hx = SIDE + 6;
  const field = (label: string, value: string, num: string, bold = false) => {
    const lw = doc.font("r").fontSize(7).widthOfString(label) + 4;
    const vw = R - hx - lw - 24;
    text(label, hx, y);
    text(value, hx + lw, y, { width: vw, font: bold ? "b" : "r" });
    const h = Math.max(9, height(value, vw, 7, bold ? "b" : "r"));
    line(hx + lw, y + h, R - 24, y + h, 0.3);
    text(num, R - 22, y, { width: 22, align: "right" });
    y += h + 1.5;
  };
  doc.font("b").fontSize(9).text(`Счет-фактура № ${data.number}   от ${data.dateText}`, hx, y);
  text("(1)", R - 22, y + 1, { width: 22, align: "right" });
  y += 12;
  text("Исправление № --   от --", hx, y);
  text("(1а)", R - 22, y, { width: 22, align: "right" });
  y += 11;
  field("Продавец:", SELLER.name, "(2)", true);
  field("Адрес:", SELLER.address, "(2а)");
  field("ИНН/КПП продавца:", SELLER.inn, "(2б)");
  field("Грузоотправитель и его адрес:", "он же", "(3)");
  field("Грузополучатель и его адрес:", data.consignee, "(4)");
  field("К платежно-расчетному документу №", data.payments || "--", "(5)");
  field("Документ об отгрузке", `№ п/п 1-${rows.length} № ${data.shipmentNumber} от ${data.date}`, "(5а)");
  field("Покупатель:", data.buyer.name, "(6)", true);
  field("Адрес:", data.buyer.address, "(6а)");
  field("ИНН/КПП покупателя:", [data.buyer.inn, data.buyer.kpp].filter(Boolean).join("/"), "(6б)");
  field("Валюта: наименование, код", "Российский рубль, 643", "(7)");
  field("Идентификатор государственного контракта, договора (соглашения) (при наличии):", "", "(8)");
  y = Math.max(y, 34 + 172) + 4;

  // ---- Table ------------------------------------------------------------------
  const xs: number[] = [];
  COLUMNS.reduce((x, [, w]) => (xs.push(x), x + w), L);
  const tableHeader = () => {
    const h = Math.max(...COLUMNS.map(([label, w]) => height(label, w - 4, 5.5))) + 6;
    COLUMNS.forEach(([label, w], i) => {
      doc.lineWidth(0.5).rect(xs[i], y, w, h).stroke();
      text(label, xs[i] + 2, y + 3, { width: w - 4, align: "center", size: 5.5 });
      doc.lineWidth(0.5).rect(xs[i], y + h, w, 9).stroke();
      text(COLUMNS[i][2], xs[i], y + h + 1.5, { width: w, align: "center", size: 6 });
    });
    y += h + 9;
  };
  tableHeader();
  rows.forEach((r, n) => {
    const cells = [
      r.sku,
      String(n + 1),
      r.name,
      "--",
      "796",
      "шт",
      qty(r.quantity),
      money(r.unitNoVat),
      money(r.noVat),
      "без акциза",
      vatLabel,
      money(r.vat),
      money(r.sum),
      "--",
      "--",
      "--",
    ];
    const h = Math.max(...cells.map((c, i) => height(c, COLUMNS[i][1] - 4))) + 4;
    if (y + h > BOTTOM - 20) {
      doc.addPage();
      y = 24;
      tableHeader();
    }
    cells.forEach((c, i) => {
      doc.lineWidth(0.5).rect(xs[i], y, COLUMNS[i][1], h).stroke();
      const right = i >= 6 && i <= 12 && i !== 9 && i !== 10;
      text(c, xs[i] + 2, y + 2, { width: COLUMNS[i][1] - 4, align: right ? "right" : i === 2 ? "left" : "center" });
    });
    y += h;
  });
  // Всего к оплате (9).
  const th = 11;
  const tx = xs[1];
  doc.lineWidth(0.5).rect(tx, y, xs[8] - tx, th).stroke();
  text("Всего к оплате (9)", tx + 2, y + 2, { font: "b" });
  const cell = (i: number, s: string, span = 1) => {
    const w = COLUMNS.slice(i, i + span).reduce((a, [, cw]) => a + cw, 0);
    doc.lineWidth(0.5).rect(xs[i], y, w, th).stroke();
    text(s, xs[i] + 2, y + 2, { width: w - 4, align: s === "X" ? "center" : "right", font: "b" });
  };
  cell(8, money(total - totalVat));
  cell(9, "X", 2);
  cell(11, money(totalVat));
  cell(12, money(total));
  y += th + 8;

  // ---- Signatures and the transfer part ---------------------------------------
  if (y + 190 > BOTTOM) {
    doc.addPage();
    y = 24;
  }
  const half = (R - L) / 2;
  const sign = (x: number, w: number, role: string, name: string, seal: boolean) => {
    text(role, x, y, { width: w * 0.36, size: 6 });
    const sx = x + w * 0.38;
    line(sx, y + 14, sx + w * 0.22, y + 14, 0.3);
    text("(подпись)", sx, y + 15, { width: w * 0.22, align: "center", size: 5 });
    line(sx + w * 0.25, y + 14, x + w, y + 14, 0.3);
    text(name, sx + w * 0.25, y + 5, { width: w * 0.37, align: "center" });
    text("(ф.и.о.)", sx + w * 0.25, y + 15, { width: w * 0.37, align: "center", size: 5 });
    if (seal && existsSync(SIGNATURE)) doc.image(SIGNATURE, sx + 4, y - 8, { fit: [w * 0.18, 26] });
  };
  text("Документ составлен на 1 листе", L, y, { width: 100, size: 6 });
  sign(SIDE + 6, half - 70, "Руководитель организации или иное уполномоченное лицо", "", false);
  sign(SIDE + half - 50, R - (SIDE + half - 50), "Главный бухгалтер или иное уполномоченное лицо", "", false);
  y += 26;
  sign(SIDE + 6, half - 70, "Индивидуальный предприниматель или иное уполномоченное лицо", SELLER.signer, true);
  line(SIDE + half - 50, y + 14, R, y + 14, 0.3);
  text("(реквизиты свидетельства о государственной регистрации индивидуального предпринимателя)", SIDE + half - 50, y + 15, { width: R - (SIDE + half - 50), align: "center", size: 5 });
  y += 26;
  line(L, y, R, y, 0.8);
  y += 4;

  const wide = (label: string, value: string, num: string) => {
    text(label, L, y, { size: 6.5 });
    const lw = doc.font("r").fontSize(6.5).widthOfString(label) + 6;
    text(value, L + lw, y, { width: R - L - lw - 24 });
    line(L + lw, y + 9, R - 24, y + 9, 0.3);
    text(num, R - 22, y, { width: 22, align: "right" });
    y += 13;
  };
  wide("Основание передачи (сдачи) / получения (приемки)", data.basis, "[8]");
  wide("Данные о транспортировке и грузе", data.transport, "[9]");

  const top = y;
  const col = (x: number, w: number, items: [string, string, string, boolean?][]) => {
    y = top;
    for (const [label, value, num, signed] of items) {
      text(`${label} ${num}`, x, y, { width: w, size: 6 });
      y += height(`${label} ${num}`, w, 6) + 1;
      if (signed !== undefined) {
        sign(x, w, value ? "Предприниматель" : "", value, !!signed);
        y += 22;
      } else {
        text(value, x, y, { width: w });
        line(x, y + 9, x + w, y + 9, 0.3);
        y += 13;
      }
    }
    return y;
  };
  const leftEnd = col(L, half - 12, [
    ["Товар (груз) передал / услуги, результаты работ, права сдал", SELLER.signer, "[10]", true],
    ["Дата отгрузки, передачи (сдачи)", data.dateText, "[11]"],
    ["Иные сведения об отгрузке, передаче", "", "[12]"],
    ["Ответственный за правильность оформления факта хозяйственной жизни", SELLER.signer, "[13]", true],
    ["Наименование экономического субъекта – составителя документа (в т.ч. комиссионера / агента)", `${SELLER.name}, ИНН ${SELLER.inn}`, "[14]"],
  ]);
  text("М.П.", L, leftEnd + 2, { size: 7 });
  if (existsSync(STAMP)) doc.image(STAMP, L + half * 0.62, leftEnd - 62, { fit: [80, 80] });
  line(L + half - 4, top - 2, L + half - 4, leftEnd + 10, 0.5);
  const rightEnd = col(L + half + 4, half - 4, [
    ["Товар (груз) получил / услуги, результаты работ, права принял", "", "[15]", false],
    ["Дата получения (приемки)", "«____» ______________ 20___ г.", "[16]"],
    ["Иные сведения о получении, приемке", "", "[17]"],
    ["Ответственный за правильность оформления факта хозяйственной жизни", "", "[18]", false],
    [
      "Наименование экономического субъекта – составителя документа",
      [data.buyer.name, data.buyer.inn && `ИНН/КПП ${[data.buyer.inn, data.buyer.kpp].filter(Boolean).join("/")}`].filter(Boolean).join(", "),
      "[19]",
    ],
  ]);
  text("М.П.", L + half + 4, rightEnd + 2, { size: 7 });

  doc.end();
  return done;
}
