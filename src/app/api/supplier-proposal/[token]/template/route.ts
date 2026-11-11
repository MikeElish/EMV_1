import { loadSupplierQuote } from "@/lib/supplier-quote";
import { supplierQuoteWorkbook } from "@/lib/supplier-quote-sheet";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/supplier-proposal/[token]/template">
) {
  const { token } = await params;
  const quote = await loadSupplierQuote(token);
  if (!quote || !quote.rows.length) {
    return Response.json({ error: "Ссылка на запрос больше не активна" }, { status: 410 });
  }
  const file = await supplierQuoteWorkbook(quote.rows);
  const filename = `Запрос-${quote.orderNumber.replace(/[^a-zA-Z0-9_-]/g, "-")}.xlsx`;
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
