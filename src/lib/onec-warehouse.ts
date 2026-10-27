import "server-only";
import { oneCGet, oneCGetAll } from "@/lib/onec";
import { GOODS_ACCOUNTS } from "@/lib/onec-stock";
import { prisma } from "@/lib/prisma";

// Склад and Отчёты → Движение товаров. 1С:Бухгалтерия keeps the goods
// accounts (41) by item and batch only, not by warehouse, but every document
// names its warehouse: each movement of the accounts goes to the warehouse of
// the document behind it (none named: «Основной склад»). Transfers between
// warehouses don't touch the accounts and are read from their documents.

export type Warehouse = { ref: string; name: string };

export type Movement = {
  /** 1С document date, Moscow time ("2026-10-27T12:00:00"). */
  date: string;
  docRef: string;
  /** «Поступление № 0000-000001». */
  doc: string;
  /** Counterparty, or what the posting says. */
  party: string;
  warehouseRef: string;
  itemRef: string;
  qtyIn: number;
  qtyOut: number;
};

export type Item = { name: string; sku: string; productId: string | null };

export type WarehouseData = {
  warehouses: Warehouse[];
  movements: Movement[];
  items: Record<string, Item>;
  loadedAt: string;
};

const DOC_LABELS: Record<string, string> = {
  ПоступлениеТоваровУслуг: "Поступление",
  РеализацияТоваровУслуг: "Реализация",
  СписаниеТоваров: "Списание",
  ОприходованиеТоваров: "Оприходование",
  АвансовыйОтчет: "Авансовый отчёт",
  ГТДИмпорт: "ГТД по импорту",
  КорректировкаПоступления: "Корректировка поступления",
  КорректировкаРеализации: "Корректировка реализации",
  ВозвратТоваровПоставщику: "Возврат поставщику",
  ВозвратТоваровОтПокупателя: "Возврат от покупателя",
  ПеремещениеТоваров: "Перемещение",
  ТребованиеНакладная: "Требование-накладная",
  ВводНачальныхОстатков: "Ввод остатков",
  РегламентнаяОперация: "Регламентная операция",
};

type DocHead = { Ref_Key: string; Number: string; Date: string; Склад_Key?: string; Контрагент_Key?: string };
type GoodsRecord = {
  Period: string;
  Recorder: string;
  Recorder_Type: string;
  AccountDr_Key: string;
  AccountCr_Key: string;
  ExtDimensionDr1?: string;
  ExtDimensionDr1_Type?: string;
  ExtDimensionCr1?: string;
  ExtDimensionCr1_Type?: string;
  КоличествоDr?: number | null;
  КоличествоCr?: number | null;
  Содержание?: string;
};

const EMPTY = "00000000-0000-0000-0000-000000000000";
const ITEM_TYPE = "StandardODATA.Catalog_Номенклатура";
const q = encodeURIComponent;
const given = (ref?: string | null) => (ref && ref !== EMPTY ? ref : null);

/** Headers of every document of a kind: number, date, warehouse, counterparty. */
async function docHeads(kind: string): Promise<DocHead[]> {
  try {
    return await oneCGetAll<DocHead>(`Document_${kind}`, ["Ref_Key", "Number", "Date", "Склад_Key", "Контрагент_Key"]);
  } catch {
    // Kinds without a counterparty (Списание, Оприходование…) or a warehouse.
    try {
      return await oneCGetAll<DocHead>(`Document_${kind}`, ["Ref_Key", "Number", "Date", "Склад_Key"]);
    } catch {
      return await oneCGetAll<DocHead>(`Document_${kind}`, ["Ref_Key", "Number", "Date"]);
    }
  }
}

type Transfer = {
  Ref_Key: string;
  Number: string;
  Date: string;
  Posted: boolean;
  DeletionMark: boolean;
  СкладОтправитель_Key?: string;
  СкладПолучатель_Key?: string;
  Товары?: { Номенклатура_Key?: string; Количество?: number }[];
};

async function load(): Promise<WarehouseData> {
  const [stores, chart, parties, cards, links] = await Promise.all([
    oneCGetAll<{ Ref_Key: string; Description: string; DeletionMark: boolean; IsFolder: boolean }>("Catalog_Склады", [
      "Ref_Key", "Description", "DeletionMark", "IsFolder",
    ]),
    oneCGet<{ value?: { Ref_Key: string; Code: string }[] }>(`/${q("ChartOfAccounts_Хозрасчетный")}?$select=Ref_Key,Code`),
    oneCGetAll<{ Ref_Key: string; Description: string }>("Catalog_Контрагенты", ["Ref_Key", "Description"]),
    oneCGetAll<{ Ref_Key: string; Description: string; Артикул?: string }>("Catalog_Номенклатура", ["Ref_Key", "Description", "Артикул"]),
    prisma.oneCProductLink.findMany({ select: { ref: true, productId: true } }),
  ]);

  const warehouses = stores
    .filter((s) => !s.DeletionMark && !s.IsFolder)
    .map((s) => ({ ref: s.Ref_Key, name: s.Description.trim() }))
    .sort((a, b) => (a.name === "Основной склад" ? -1 : b.name === "Основной склад" ? 1 : a.name.localeCompare(b.name, "ru")));
  const main = warehouses[0]?.ref ?? EMPTY;
  const known = new Set(warehouses.map((w) => w.ref));
  const store = (ref?: string | null) => (given(ref) && known.has(ref!) ? ref! : main);
  const partyName = new Map(parties.map((p) => [p.Ref_Key, p.Description.trim()]));

  const goods = (chart.value ?? []).filter((a) => GOODS_ACCOUNTS.includes(a.Code.trim())).map((a) => a.Ref_Key);
  const condition = goods.flatMap((g) => [`AccountDr_Key eq guid'${g}'`, `AccountCr_Key eq guid'${g}'`]).join(" or ");
  const records =
    (
      await oneCGet<{ value?: GoodsRecord[] }>(
        `/${q("AccountingRegister_Хозрасчетный")}/RecordsWithExtDimensions(Condition='${q(condition)}')`
      )
    ).value ?? [];

  const kinds = [...new Set(records.map((r) => r.Recorder_Type.replace("StandardODATA.Document_", "")))];
  const heads = new Map<string, DocHead>();
  for (const kind of kinds) for (const d of await docHeads(kind).catch(() => [])) heads.set(d.Ref_Key, d);

  const docTitle = (kind: string, head?: DocHead) =>
    `${DOC_LABELS[kind] ?? kind}${head ? ` № ${head.Number.trim()}` : ""}`;

  const movements: Movement[] = [];
  for (const r of records) {
    const kind = r.Recorder_Type.replace("StandardODATA.Document_", "");
    const head = heads.get(r.Recorder);
    const base = {
      date: r.Period,
      docRef: r.Recorder,
      doc: docTitle(kind, head),
      party: partyName.get(given(head?.Контрагент_Key) ?? "") ?? (r.Содержание ?? "").trim(),
      warehouseRef: store(head?.Склад_Key),
    };
    if (goods.includes(r.AccountDr_Key) && r.ExtDimensionDr1_Type === ITEM_TYPE && r.КоличествоDr) {
      movements.push({ ...base, itemRef: r.ExtDimensionDr1!, qtyIn: r.КоличествоDr, qtyOut: 0 });
    }
    if (goods.includes(r.AccountCr_Key) && r.ExtDimensionCr1_Type === ITEM_TYPE && r.КоличествоCr) {
      movements.push({ ...base, itemRef: r.ExtDimensionCr1!, qtyIn: 0, qtyOut: r.КоличествоCr });
    }
  }

  // Перемещение: out of one warehouse, into the other.
  const transfers = await oneCGetAll<Transfer>("Document_ПеремещениеТоваров", [
    "Ref_Key", "Number", "Date", "Posted", "DeletionMark", "СкладОтправитель_Key", "СкладПолучатель_Key", "Товары",
  ]).catch(() => [] as Transfer[]);
  for (const t of transfers) {
    if (!t.Posted || t.DeletionMark) continue;
    const from = store(t.СкладОтправитель_Key);
    const to = store(t.СкладПолучатель_Key);
    if (from === to) continue;
    for (const line of t.Товары ?? []) {
      if (!given(line.Номенклатура_Key) || !line.Количество) continue;
      const base = { date: t.Date, docRef: t.Ref_Key, doc: `Перемещение № ${t.Number.trim()}`, itemRef: line.Номенклатура_Key! };
      const toName = warehouses.find((w) => w.ref === to)?.name ?? "";
      const fromName = warehouses.find((w) => w.ref === from)?.name ?? "";
      movements.push({ ...base, party: `→ ${toName}`, warehouseRef: from, qtyIn: 0, qtyOut: line.Количество });
      movements.push({ ...base, party: `← ${fromName}`, warehouseRef: to, qtyIn: line.Количество, qtyOut: 0 });
    }
  }
  movements.sort((a, b) => a.date.localeCompare(b.date) || a.doc.localeCompare(b.doc, "ru"));

  const productOf = new Map(links.map((l) => [l.ref, l.productId]));
  const used = new Set(movements.map((m) => m.itemRef));
  const items: Record<string, Item> = {};
  for (const c of cards) {
    if (!used.has(c.Ref_Key)) continue;
    items[c.Ref_Key] = { name: c.Description.trim(), sku: (c.Артикул ?? "").trim(), productId: productOf.get(c.Ref_Key) ?? null };
  }
  return { warehouses, movements, items, loadedAt: new Date().toISOString() };
}

// 1С is read at most every 5 minutes; «Обновить» drops the copy.
const CACHE_MS = 5 * 60 * 1000;
const cacheState = globalThis as unknown as { __emvWarehouse?: { at: number; data: Promise<WarehouseData> } };

export function getWarehouseData(fresh = false): Promise<WarehouseData> {
  const hit = cacheState.__emvWarehouse;
  if (!fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.data;
  const data = load();
  cacheState.__emvWarehouse = { at: Date.now(), data };
  data.catch(() => {
    if (cacheState.__emvWarehouse?.data === data) cacheState.__emvWarehouse = undefined;
  });
  return data;
}

/** Quantity per item on a warehouse (movements up to `until`, inclusive). */
export function balances(movements: Movement[], warehouseRef: string | null, until?: string): Map<string, number> {
  const qty = new Map<string, number>();
  for (const m of movements) {
    if (warehouseRef && m.warehouseRef !== warehouseRef) continue;
    if (until && m.date > until) continue;
    qty.set(m.itemRef, (qty.get(m.itemRef) ?? 0) + m.qtyIn - m.qtyOut);
  }
  return qty;
}
