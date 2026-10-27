import { requireSection } from "@/lib/access-server";
import { OneCError } from "@/lib/onec";
import { getWarehouseData } from "@/lib/onec-warehouse";
import { CrmPage } from "@/components/admin/CrmTableFrame";
import { MovementsReport, type SummaryRow, type DocRow } from "@/components/admin/MovementsReport";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const round = (n: number) => Math.round(n * 1000) / 1000;

/** Today and the 1st of this month in Moscow, "YYYY-MM-DD". */
function defaultPeriod() {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Moscow" });
  return { from: `${today.slice(0, 8)}01`, to: today };
}

export default async function MovementsReportPage({ searchParams }: PageProps<"/admin/reports/movements">) {
  await requireSection("reports.movements");
  const sp = await searchParams;
  const pick = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const period = defaultPeriod();
  const from = DAY.test(pick("from")) ? pick("from") : period.from;
  const to = DAY.test(pick("to")) ? pick("to") : period.to;
  const view = pick("view") === "docs" ? "docs" : "summary";

  let data;
  try {
    data = await getWarehouseData();
  } catch (error) {
    return (
      <p className="text-sm text-red-600">
        {error instanceof OneCError ? error.message : "1С не ответила — отчёт недоступен, попробуйте позже."}
      </p>
    );
  }
  const warehouse = data.warehouses.some((w) => w.ref === pick("w")) ? pick("w") : "";
  const mine = data.movements.filter((m) => !warehouse || m.warehouseRef === warehouse);
  const inPeriod = mine.filter((m) => m.date.slice(0, 10) >= from && m.date.slice(0, 10) <= to);
  const item = (ref: string) => data.items[ref] ?? { name: "—", sku: "", productId: null };
  const warehouseName = new Map(data.warehouses.map((w) => [w.ref, w.name]));

  const docs: DocRow[] = inPeriod.map((m) => ({
    date: m.date,
    doc: m.doc,
    party: m.party,
    warehouse: warehouseName.get(m.warehouseRef) ?? "",
    itemRef: m.itemRef,
    ...item(m.itemRef),
    qtyIn: m.qtyIn,
    qtyOut: m.qtyOut,
  }));

  // Ведомость: opening balance, in, out, closing per item.
  const acc = new Map<string, { opening: number; qtyIn: number; qtyOut: number }>();
  for (const m of mine) {
    const day = m.date.slice(0, 10);
    if (day > to) continue;
    const a = acc.get(m.itemRef) ?? { opening: 0, qtyIn: 0, qtyOut: 0 };
    if (day < from) a.opening += m.qtyIn - m.qtyOut;
    else {
      a.qtyIn += m.qtyIn;
      a.qtyOut += m.qtyOut;
    }
    acc.set(m.itemRef, a);
  }
  const summary: SummaryRow[] = [...acc]
    .map(([itemRef, a]) => ({
      itemRef,
      ...item(itemRef),
      opening: round(a.opening),
      qtyIn: round(a.qtyIn),
      qtyOut: round(a.qtyOut),
      closing: round(a.opening + a.qtyIn - a.qtyOut),
    }))
    .filter((r) => r.opening || r.qtyIn || r.qtyOut || r.closing)
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));

  return (
    <CrmPage>
      <MovementsReport
        from={from}
        to={to}
        view={view}
        warehouse={warehouse}
        warehouses={data.warehouses}
        summary={summary}
        docs={docs}
        loadedAt={data.loadedAt}
      />
    </CrmPage>
  );
}
