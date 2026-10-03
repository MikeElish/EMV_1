import "server-only";
import { prisma } from "@/lib/prisma";
import { oneCGetAll } from "@/lib/onec";
import { buildProductSlug } from "@/lib/slug";

// ---- 1С catalogs -----------------------------------------------------------

type RawItem = {
  Ref_Key: string;
  Parent_Key: string;
  IsFolder: boolean;
  DeletionMark: boolean;
  Code: string;
  Description: string;
  НаименованиеПолное?: string;
  Артикул?: string;
  Услуга?: boolean;
  ЕдиницаИзмерения_Key?: string;
};

export type OneCGood = {
  ref: string;
  code: string;
  sku: string;
  name: string;
  group: string;
  unit: string;
};

const EMPTY_REF = "00000000-0000-0000-0000-000000000000";

/** Goods (not services, not groups, not marked for deletion) with their group path. */
export async function loadOneCGoods(): Promise<OneCGood[]> {
  const [items, units] = await Promise.all([
    oneCGetAll<RawItem>("Catalog_Номенклатура", [
      "Ref_Key", "Parent_Key", "IsFolder", "DeletionMark", "Code", "Description",
      "НаименованиеПолное", "Артикул", "Услуга", "ЕдиницаИзмерения_Key",
    ]),
    oneCGetAll<{ Ref_Key: string; Description: string }>("Catalog_КлассификаторЕдиницИзмерения", ["Ref_Key", "Description"]),
  ]);
  const folders = new Map(items.filter((i) => i.IsFolder).map((f) => [f.Ref_Key, f]));
  const unitName = new Map(units.map((u) => [u.Ref_Key, u.Description]));
  const groupPath = (parent: string) => {
    const names: string[] = [];
    for (let key = parent, guard = 0; key && key !== EMPTY_REF && guard < 20; guard++) {
      const folder = folders.get(key);
      if (!folder) break;
      names.unshift(folder.Description);
      key = folder.Parent_Key;
    }
    return names.join(" / ");
  };
  return items
    .filter((i) => !i.IsFolder && !i.DeletionMark && !i.Услуга)
    .map((i) => ({
      ref: i.Ref_Key,
      code: (i.Code ?? "").trim(),
      sku: (i.Артикул ?? "").trim(),
      name: (i.НаименованиеПолное || i.Description || "").trim(),
      group: groupPath(i.Parent_Key),
      unit: unitName.get(i.ЕдиницаИзмерения_Key ?? "") ?? "",
    }));
}

/** Same spelling rules for comparing SKUs and names: case, spaces and separators ignored. */
export const matchKey = (s: string) => s.toUpperCase().replace(/[\s\-_.\/\\]/g, "");

// ---- Product matching ------------------------------------------------------

export type ProductRef = { id: string; sku: string; name: string; brand: string | null };

export type ProductMatching = {
  /** Site products linked to at least one 1С card. */
  linked: number;
  /** Exactly one free 1С card with the same SKU -- linked by «Связать автоматически». */
  auto: { product: ProductRef; good: OneCGood }[];
  /** Several 1С cards share the SKU (duplicates in 1С): link all of them, one, or none. */
  ambiguous: { product: ProductRef; candidates: OneCGood[] }[];
  /** No SKU match, but exactly one free card with the same name: confirm by hand. */
  byName: { product: ProductRef; good: OneCGood }[];
  /** Site products with no counterpart in 1С (will be created there later). */
  siteOnly: number;
  /** 1С goods with no site product, grouped: cards with one article become one product. */
  oneCOnly: OneCGood[][];
};

export async function computeProductMatching(goods: OneCGood[]): Promise<ProductMatching> {
  const [products, links] = await Promise.all([
    prisma.product.findMany({
      select: { id: true, sku: true, name: true, brand: true, oneCNoMatch: true },
      orderBy: { sku: "asc" },
    }),
    prisma.oneCProductLink.findMany({ select: { ref: true, productId: true } }),
  ]);
  const linkedRefs = new Set(links.map((l) => l.ref));
  const linkedProducts = new Set(links.map((l) => l.productId));
  const free = goods.filter((g) => !linkedRefs.has(g.ref));

  const bySku = new Map<string, OneCGood[]>();
  const byName = new Map<string, OneCGood[]>();
  for (const g of free) {
    if (g.sku) bySku.set(matchKey(g.sku), [...(bySku.get(matchKey(g.sku)) ?? []), g]);
    byName.set(matchKey(g.name), [...(byName.get(matchKey(g.name)) ?? []), g]);
  }

  const result: ProductMatching = {
    linked: linkedProducts.size,
    auto: [],
    ambiguous: [],
    byName: [],
    siteOnly: 0,
    oneCOnly: [],
  };
  // A 1С card offered to one product is not offered to another one.
  const claimed = new Set<string>();
  for (const p of products) {
    if (linkedProducts.has(p.id)) continue;
    if (p.oneCNoMatch) {
      result.siteOnly++;
      continue;
    }
    const ref = { id: p.id, sku: p.sku, name: p.name, brand: p.brand };
    const skuHits = (bySku.get(matchKey(p.sku)) ?? []).filter((g) => !claimed.has(g.ref));
    if (skuHits.length === 1) {
      result.auto.push({ product: ref, good: skuHits[0] });
      claimed.add(skuHits[0].ref);
    } else if (skuHits.length > 1) {
      result.ambiguous.push({ product: ref, candidates: skuHits });
      skuHits.forEach((g) => claimed.add(g.ref));
    } else {
      const nameHits = (byName.get(matchKey(p.name)) ?? []).filter((g) => !claimed.has(g.ref));
      if (nameHits.length === 1) {
        result.byName.push({ product: ref, good: nameHits[0] });
        claimed.add(nameHits[0].ref);
      } else {
        result.siteOnly++;
      }
    }
  }

  // Unclaimed cards: the same article -> one future product.
  const groups = new Map<string, OneCGood[]>();
  for (const g of free) {
    if (claimed.has(g.ref)) continue;
    const key = g.sku ? `sku:${matchKey(g.sku)}` : `ref:${g.ref}`;
    groups.set(key, [...(groups.get(key) ?? []), g]);
  }
  result.oneCOnly = [...groups.values()];
  return result;
}

/** Links a site product to 1С cards (refs already linked elsewhere are skipped). */
export async function linkProduct(productId: string, refs: string[]) {
  let added = 0;
  for (const ref of refs) {
    const existing = await prisma.oneCProductLink.findUnique({ where: { ref } });
    if (existing) continue;
    await prisma.oneCProductLink.create({ data: { ref, productId } });
    added++;
  }
  if (added) await prisma.product.update({ where: { id: productId }, data: { oneCNoMatch: false } });
  return added;
}

// ---- Import of 1С-only goods ----------------------------------------------

export const IMPORT_CATEGORY_SLUG = "iz-1s";
const IMPORT_CATEGORY_NAME = "Из 1С — не распределено";

/**
 * Inactive products for 1С goods with no site product, in a holding category:
 * one product per group of cards sharing an article. Returns how many were created.
 */
export async function importGoodsAsInactive(groups: OneCGood[][]): Promise<number> {
  const category = await prisma.category.upsert({
    where: { slug: IMPORT_CATEGORY_SLUG },
    create: { slug: IMPORT_CATEGORY_SLUG, name: IMPORT_CATEGORY_NAME },
    update: {},
  });
  const taken = await prisma.product.findMany({ select: { sku: true, slug: true } });
  const skus = new Set(taken.map((t) => t.sku.toUpperCase()));
  const slugs = new Set(taken.map((t) => t.slug));

  let created = 0;
  for (const group of groups) {
    const refs = group.map((g) => g.ref);
    if (await prisma.oneCProductLink.findFirst({ where: { ref: { in: refs } }, select: { ref: true } })) continue;
    // Prefer the card with the fullest name as the product's own data.
    const main = [...group].sort((a, b) => b.name.length - a.name.length)[0];
    const fallback = `1C-${main.code || main.ref.slice(0, 8)}`;
    let sku = (main.sku || fallback).slice(0, 64);
    if (skus.has(sku.toUpperCase())) sku = `${sku}-${main.code || main.ref.slice(0, 8)}`.slice(0, 64);
    let slug = buildProductSlug(null, sku) || `1c-${main.ref.slice(0, 8)}`;
    if (slugs.has(slug)) slug = `${slug}-${main.ref.slice(0, 8)}`;
    skus.add(sku.toUpperCase());
    slugs.add(slug);

    await prisma.product.create({
      data: {
        sku,
        name: (main.name || sku).slice(0, 200),
        slug,
        price: 0,
        stock: 0,
        images: [],
        categoryId: category.id,
        isActive: false,
        attributes: {
          ...(main.group ? { "Группа в 1С": main.group } : {}),
          ...(main.unit ? { "Единица измерения": main.unit } : {}),
          "Код в 1С": group.map((g) => g.code).filter(Boolean).join(", "),
        },
        oneCLinks: { create: refs.map((ref) => ({ ref })) },
      },
    });
    created++;
  }
  return created;
}

// ---- Counterparties --------------------------------------------------------

type RawCounterparty = {
  Ref_Key: string;
  IsFolder: boolean;
  DeletionMark: boolean;
  Description: string;
  ИНН?: string;
  КПП?: string;
};
type RawContract = {
  Ref_Key: string;
  Owner_Key: string;
  IsFolder: boolean;
  DeletionMark: boolean;
  Description: string;
  ВидДоговора?: string;
  Номер?: string;
  Дата?: string;
};

export type CounterpartyPlan = {
  /** Already linked to a company on the site. */
  linked: number;
  /** A company with the same ИНН (and КПП) exists -- will be linked. */
  toLink: { companyId: string; companyName: string; ref: string; name: string; inn: string }[];
  /** No company yet -- will be created. */
  toCreate: { ref: string; name: string; inn: string; kpp: string; type: string; contract: string | null }[];
};

const contractTitle = (c: RawContract) => {
  const date = c.Дата && !c.Дата.startsWith("0001") ? new Date(c.Дата).toLocaleDateString("ru-RU") : "";
  return c.Номер ? `№ ${c.Номер}${date ? ` от ${date}` : ""}` : c.Description;
};

export async function planCounterparties(): Promise<CounterpartyPlan> {
  const [raw, contracts, companies] = await Promise.all([
    oneCGetAll<RawCounterparty>("Catalog_Контрагенты", ["Ref_Key", "IsFolder", "DeletionMark", "Description", "ИНН", "КПП"]),
    oneCGetAll<RawContract>("Catalog_ДоговорыКонтрагентов", [
      "Ref_Key", "Owner_Key", "IsFolder", "DeletionMark", "Description", "ВидДоговора", "Номер", "Дата",
    ]),
    prisma.company.findMany({ select: { id: true, name: true, inn: true, kpp: true, oneCRef: true } }),
  ]);
  const byOwner = new Map<string, RawContract[]>();
  for (const c of contracts) {
    if (c.IsFolder || c.DeletionMark) continue;
    byOwner.set(c.Owner_Key, [...(byOwner.get(c.Owner_Key) ?? []), c]);
  }
  const linkedRefs = new Set(companies.map((c) => c.oneCRef).filter(Boolean));
  const plan: CounterpartyPlan = { linked: 0, toLink: [], toCreate: [] };

  for (const k of raw) {
    if (k.IsFolder || k.DeletionMark) continue;
    if (linkedRefs.has(k.Ref_Key)) {
      plan.linked++;
      continue;
    }
    const inn = (k.ИНН ?? "").trim();
    const kpp = (k.КПП ?? "").trim();
    const sameInn = inn
      ? companies.find((c) => !c.oneCRef && c.inn?.trim() === inn && (!kpp || !c.kpp || c.kpp === kpp))
      : undefined;
    if (sameInn) {
      plan.toLink.push({ companyId: sameInn.id, companyName: sameInn.name, ref: k.Ref_Key, name: k.Description, inn });
      continue;
    }
    const own = byOwner.get(k.Ref_Key) ?? [];
    const supplier = own.some((c) => c.ВидДоговора === "СПоставщиком");
    const buyerContract = own.find((c) => c.ВидДоговора === "СПокупателем");
    plan.toCreate.push({
      ref: k.Ref_Key,
      name: k.Description.trim(),
      inn,
      kpp,
      type: supplier ? "Поставщик" : "Клиент",
      contract: buyerContract ? contractTitle(buyerContract) : null,
    });
  }
  return plan;
}

export async function applyCounterparties(plan: CounterpartyPlan) {
  for (const l of plan.toLink) {
    await prisma.company.update({ where: { id: l.companyId }, data: { oneCRef: l.ref } });
  }
  for (const c of plan.toCreate) {
    await prisma.company.upsert({
      where: { oneCRef: c.ref },
      create: {
        name: c.name,
        inn: c.inn || null,
        kpp: c.kpp || null,
        type: c.type,
        hasContract: !!c.contract,
        contract: c.contract,
        oneCRef: c.ref,
      },
      update: {},
    });
  }
  return { linked: plan.toLink.length, created: plan.toCreate.length };
}
