import "server-only";
import PDFDocument from "pdfkit";
import { FONT, FONT_BOLD } from "@/lib/invoice-pdf";
import { MONTH_NAMES } from "@/lib/period";
import type { PayrollLine } from "@/lib/payroll";

// «Расчётный листок» of a month: one page per employee.

const money = (k: number) => (k / 100).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/ /g, " ");

export function renderPayslips(month: string, lines: PayrollLine[], employer: string): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A5", layout: "landscape", margins: { top: 30, bottom: 30, left: 36, right: 36 }, autoFirstPage: false });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
  doc.registerFont("r", FONT);
  doc.registerFont("b", FONT_BOLD);
  const [y, m] = month.split("-").map(Number);
  const title = `${MONTH_NAMES[m - 1]} ${y}`;

  for (const l of lines) {
    doc.addPage();
    const L = doc.page.margins.left;
    const W = doc.page.width - L - doc.page.margins.right;
    doc.font("r").fontSize(9).fillColor("#555").text(employer, L, 30, { width: W });
    doc.font("b").fontSize(15).fillColor("#000").text(`Расчётный листок за ${title.toLowerCase()}`, L, 50, { width: W });
    doc.font("b").fontSize(12).text(l.name, L, 80, { width: W });
    doc.font("r").fontSize(10).fillColor("#333").text(l.position || "—", L, 98, { width: W });

    let top = 130;
    const row = (label: string, value: string, bold = false) => {
      doc.font(bold ? "b" : "r").fontSize(11).fillColor("#000").text(label, L, top, { width: W - 160 });
      doc.text(value, L + W - 160, top, { width: 160, align: "right" });
      top += 22;
      doc.lineWidth(0.4).strokeColor("#ccc").moveTo(L, top - 5).lineTo(L + W, top - 5).stroke();
    };
    row("Начислено", `${money(l.accrued)} ₽`, true);
    row("НДФЛ 13% (удержано)", `${money(Math.round(l.accrued * 0.13))} ₽`);
    const net = l.accrued - Math.round(l.accrued * 0.13);
    row("К выплате", `${money(net)} ₽`, true);
    row("   в т.ч. наличными", `${money(l.cash)} ₽`);
    row("   в т.ч. на карту", `${money(Math.max(0, net - l.cash))} ₽`);
    doc.font("r").fontSize(9).fillColor("#555").text(`Расчёт: ${l.calculation}`, L, top + 6, { width: W });
    doc.font("r").fontSize(9).fillColor("#555").text("Подпись работника ____________________", L, doc.page.height - 60, { width: W });
  }
  if (!lines.length) doc.addPage().font("r").fontSize(12).text("В ведомости за месяц нет начислений.");
  doc.end();
  return done;
}
