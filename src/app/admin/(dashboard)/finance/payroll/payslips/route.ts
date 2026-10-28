import { prisma } from "@/lib/prisma";
import { accessDenied } from "@/lib/access-server";
import { payrollOf } from "@/lib/payroll";
import { renderPayslips } from "@/lib/payslip-pdf";

/** «Сформировать расчётки»: the month's payslips as one PDF; the ведомость is kept as it is. */
export async function GET(request: Request) {
  const denied = await accessDenied("finance.payroll", "view");
  if (denied) return new Response(denied.error, { status: 403 });
  const month = new URL(request.url).searchParams.get("month") ?? "";
  if (!/^\d{4}-\d{2}$/.test(month)) return new Response("Некорректный месяц", { status: 400 });

  const lines = (await payrollOf(month)).filter((l) => l.accrued > 0);
  // The figures printed are the ones kept from now on.
  for (const l of lines) {
    const data = { position: l.position || null, calculation: l.calculation, accrued: l.accrued, cash: l.cash, output: l.output, manual: l.manual };
    await prisma.payrollRow.upsert({ where: { month_userId: { month, userId: l.userId } }, create: { month, userId: l.userId, ...data }, update: data });
  }
  const own = await prisma.company.findFirst({ where: { isOwn: true }, select: { name: true, inn: true } });
  const pdf = await renderPayslips(month, lines, `ИП Елишев Михаил Владимирович${own?.inn ? `, ИНН ${own.inn}` : ""}`);
  const name = `Расчётные листки ${month}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="payslips-${month}.pdf"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
