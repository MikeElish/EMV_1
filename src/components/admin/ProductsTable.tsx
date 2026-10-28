"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { utils, write } from "xlsx";
import type { Product, Category, ProductPricing } from "@prisma/client";
import { formatRub } from "@/lib/money";
import { ORDER_STATUS_LABELS } from "@/lib/validators/orders";
import { deleteProduct, listProductReserve, type ProductDocumentLine } from "@/actions/admin/products";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { ActiveToggle } from "@/components/admin/ActiveToggle";
import { CrmTableScroll, STICKY_THEAD } from "@/components/admin/CrmTableFrame";
import { Modal } from "@/components/Modal";
import {
  PRODUCTS_RETURN_KEY,
  saveProductsPlace,
  type ProductsReturnState,
} from "@/components/admin/products-return";
import { useRememberedState } from "@/components/admin/AdminPlaces";

type ProductRow = Product & {
  category: Category;
  pricing: (ProductPricing & { supplier: { name: string } | null }) | null;
};

const priceOrDash = (kopecks: number | undefined) => (kopecks === undefined ? "—" : formatRub(kopecks));

function buildExportHref(products: ProductRow[]) {
  const header = ["Товар", "Артикул", "Бренд", "Категория", "Поставщик", "Закупка", "Розница", "Опт", "Дилер", "Остаток", "Активен"];
  const body = products.map((product) => [
    product.name,
    product.sku,
    product.brand ?? "",
    product.category.name,
    product.pricing?.supplier?.name ?? "",
    priceOrDash(product.pricing?.purchasePrice),
    priceOrDash(product.pricing?.retailPrice),
    formatRub(product.price),
    priceOrDash(product.pricing?.dealerPrice),
    product.stock,
    product.isActive ? "Да" : "Нет",
  ]);
  const worksheet = utils.aoa_to_sheet([header, ...body]);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, "Товары");
  const base64 = write(workbook, { type: "base64", bookType: "xlsx" });
  return `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;
}

/** Orders holding the product in reserve; a click on the number opens the order. */
function ReserveDialog({ product, onClose }: { product: ProductRow; onClose: () => void }) {
  const [lines, setLines] = useState<ProductDocumentLine[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    listProductReserve(product.id).then((result) => {
      if (!cancelled) setLines(result);
    });
    return () => {
      cancelled = true;
    };
  }, [product.id]);

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-xl">
      <h2 className="text-lg font-semibold">Резерв</h2>
      <p className="mt-1 text-sm text-foreground/60">
        {product.name} · {product.sku}
      </p>
      {lines === null ? (
        <p className="mt-4 text-sm text-foreground/50">Загрузка...</p>
      ) : lines.length === 0 ? (
        <p className="mt-4 text-sm text-foreground/50">Резерва нет.</p>
      ) : (
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-foreground/10 text-left text-foreground/50">
              <th className="py-2 pr-4">Документ</th>
              <th className="py-2 pr-4">Статус</th>
              <th className="py-2 text-right">Количество</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="border-b border-foreground/10">
                <td className="py-2 pr-4">
                  <Link
                    href={`/admin/crm/orders?orderNumber=${encodeURIComponent(line.orderNumber)}`}
                    className="font-medium underline underline-offset-4 hover:opacity-80"
                  >
                    Заказ {line.orderNumber}
                  </Link>
                  <span className="ml-2 text-xs text-foreground/50">
                    от {new Date(line.date).toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" })}
                  </span>
                </td>
                <td className="py-2 pr-4 text-foreground/70">{ORDER_STATUS_LABELS[line.status]}</td>
                <td className="py-2 text-right">{line.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

function StockCell({
  product,
  reserved,
  onReserve,
}: {
  product: ProductRow;
  reserved: number;
  onReserve: () => void;
}) {
  // Incoming quantities come with "Заказ поставщику" -- zero until then.
  const incoming = 0;
  return (
    <span className="whitespace-nowrap">
      {product.stock}
      <span className="px-1 text-foreground/30">/</span>
      {reserved > 0 ? (
        <button
          type="button"
          onClick={onReserve}
          title="Показать заказы"
          className="font-medium text-blue-600 underline underline-offset-4 hover:opacity-80 dark:text-blue-400"
        >
          {reserved}
        </button>
      ) : (
        <span className="text-foreground/50">0</span>
      )}
      <span className="px-1 text-foreground/30">/</span>
      <span className="text-foreground/50">{incoming}</span>
    </span>
  );
}

// ---- Column filters (as in Заказы) ---------------------------------------------------

type Filters = {
  product: string;
  category: string;
  supplier: string;
  purchase: string;
  retail: string;
  wholesale: string;
  dealer: string;
  stock: string;
  active: "" | "yes" | "no";
};
const EMPTY_FILTERS: Filters = {
  product: "",
  category: "",
  supplier: "",
  purchase: "",
  retail: "",
  wholesale: "",
  dealer: "",
  stock: "",
  active: "",
};
type TextFilter = Exclude<keyof Filters, "category" | "active">;

const has = (value: string, query: string) => value.toLowerCase().includes(query.trim().toLowerCase());
/** A price filter as typed: «1500», «1 500», «1500,5». */
const priceMatches = (kopecks: number | undefined, query: string) =>
  kopecks !== undefined && String(kopecks / 100).includes(query.replace(/\s/g, "").replace(",", "."));

const filterInputClassName =
  "w-full rounded-md border border-foreground/20 bg-transparent px-2 py-1 text-xs font-normal outline-none focus:border-foreground/50";

export function ProductsTable({
  products,
  reserve,
}: {
  products: ProductRow[];
  /** productId -> quantity reserved in customer orders. */
  reserve: Record<string, number>;
}) {
  const router = useRouter();
  const [filters, setFilters] = useRememberedState<Filters>("filters", EMPTY_FILTERS);
  const [reserveOf, setReserveOf] = useState<ProductRow | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingScroll = useRef<number | null>(null);

  // Back from a product card: the same filters and the same scroll position.
  // Runs on a fresh mount and also when Next shows the kept (hidden) page
  // again on «Назад» -- then the rows are still there but the frame's
  // scrollTop was reset while it was hidden.
  const filtersRef = useRef(filters);
  useLayoutEffect(() => {
    filtersRef.current = filters;
  });
  useLayoutEffect(() => {
    let saved: ProductsReturnState;
    try {
      const raw = sessionStorage.getItem(PRODUCTS_RETURN_KEY);
      if (!raw) return;
      sessionStorage.removeItem(PRODUCTS_RETURN_KEY);
      saved = JSON.parse(raw) as ProductsReturnState;
    } catch {
      return;
    }
    if (Date.now() - saved.at > 60 * 60 * 1000 || !saved.filters) return;
    const restored = { ...EMPTY_FILTERS, ...saved.filters } as Filters;
    if (JSON.stringify(restored) === JSON.stringify(filtersRef.current) && scrollRef.current) {
      scrollRef.current.scrollTop = saved.scrollTop;
      return;
    }
    pendingScroll.current = saved.scrollTop;
    setFilters(restored);
    // Once, when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category.name))].sort((a, b) => a.localeCompare(b, "ru")),
    [products]
  );

  const filtered = useMemo(
    () =>
      products.filter((p) => {
        const f = filters;
        if (f.product && !has(`${p.name} ${p.sku} ${p.brand ?? ""}`, f.product)) return false;
        if (f.category && p.category.name !== f.category) return false;
        if (f.supplier && !has(p.pricing?.supplier?.name ?? "", f.supplier)) return false;
        if (f.purchase && !priceMatches(p.pricing?.purchasePrice, f.purchase)) return false;
        if (f.retail && !priceMatches(p.pricing?.retailPrice, f.retail)) return false;
        if (f.wholesale && !priceMatches(p.price, f.wholesale)) return false;
        if (f.dealer && !priceMatches(p.pricing?.dealerPrice, f.dealer)) return false;
        if (f.stock && !has(String(p.stock), f.stock)) return false;
        if (f.active && p.isActive !== (f.active === "yes")) return false;
        return true;
      }),
    [products, filters]
  );
  // «Выгрузить» takes what is on screen.
  const exportHref = useMemo(() => buildExportHref(filtered), [filtered]);
  const hasActiveFilters = Object.values(filters).some(Boolean);

  useLayoutEffect(() => {
    if (pendingScroll.current === null || !scrollRef.current) return;
    scrollRef.current.scrollTop = pendingScroll.current;
    pendingScroll.current = null;
  }, [filtered]);

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function textFilter(key: TextFilter) {
    return (
      <input
        type="text"
        value={filters[key]}
        onChange={(e) => setFilter(key, e.target.value)}
        placeholder="Поиск..."
        className={filterInputClassName}
      />
    );
  }

  function rememberPlace() {
    saveProductsPlace(filters, scrollRef.current?.scrollTop ?? 0);
  }

  function openProduct(id: string) {
    rememberPlace();
    router.push(`/admin/crm/products/${id}/edit`);
  }

  return (
    <>
      <div className="flex shrink-0 items-center justify-between">
        <h1 className="text-2xl font-bold">Товары</h1>
        <div className="flex items-center gap-3">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="text-sm text-foreground/50 hover:text-foreground"
            >
              Сбросить фильтры
            </button>
          )}
          <Link
            href="/admin/crm/products/import"
            className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium"
          >
            Импорт CSV/Excel
          </Link>
          <Link
            href="/admin/crm/products/new"
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            Добавить товар
          </Link>
          <a
            href={exportHref}
            download="tovary.xlsx"
            title={hasActiveFilters ? `Выгрузить отфильтрованные товары: ${filtered.length}` : undefined}
            className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
          >
            Выгрузить
          </a>
        </div>
      </div>

      {products.length === 0 ? (
        <p className="mt-6 text-sm text-foreground/40">Товаров пока нет.</p>
      ) : (
        <CrmTableScroll ref={scrollRef} className="mt-6">
          <table className="w-full text-sm">
            <thead className={STICKY_THEAD}>
              <tr className="text-left text-foreground/50">
                <th className="py-2 pr-3">Товар</th>
                <th className="py-2 pr-3">Категория</th>
                <th className="py-2 pr-3">Поставщик</th>
                <th className="py-2 pr-3">Закупка</th>
                <th className="py-2 pr-3">Розница</th>
                <th className="py-2 pr-3">Опт</th>
                <th className="py-2 pr-3">Дилер</th>
                <th className="py-2 pr-3">Остаток / Резерв / К поступлению</th>
                <th className="py-2 pr-3">Активен</th>
                <th className="py-2" />
              </tr>
              <tr className="text-left">
                <th className="pb-2 pr-3">{textFilter("product")}</th>
                <th className="pb-2 pr-3">
                  <select
                    value={filters.category}
                    onChange={(e) => setFilter("category", e.target.value)}
                    aria-label="Фильтр: категория"
                    className={`${filterInputClassName} bg-background`}
                  >
                    <option value="">Все</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </th>
                <th className="pb-2 pr-3">{textFilter("supplier")}</th>
                <th className="pb-2 pr-3">{textFilter("purchase")}</th>
                <th className="pb-2 pr-3">{textFilter("retail")}</th>
                <th className="pb-2 pr-3">{textFilter("wholesale")}</th>
                <th className="pb-2 pr-3">{textFilter("dealer")}</th>
                <th className="pb-2 pr-3">{textFilter("stock")}</th>
                <th className="pb-2 pr-3">
                  <select
                    value={filters.active}
                    onChange={(e) => setFilter("active", e.target.value as Filters["active"])}
                    aria-label="Фильтр: активен"
                    className={`${filterInputClassName} bg-background`}
                  >
                    <option value="">Все</option>
                    <option value="yes">Да</option>
                    <option value="no">Нет</option>
                  </select>
                </th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-4 text-sm text-foreground/40">
                    Ничего не найдено.
                  </td>
                </tr>
              )}
              {filtered.map((product) => (
                <tr
                  key={product.id}
                  onClick={(e) => {
                    // Buttons, links and toggles in the row do their own thing.
                    if ((e.target as HTMLElement).closest("a, button, input, select, label")) return;
                    openProduct(product.id);
                  }}
                  className="cursor-pointer border-b border-foreground/10 transition-colors hover:bg-foreground/5"
                >
                  <td className="py-2 pr-3">
                    <div>{product.name}</div>
                    <div className="text-xs text-foreground/40">{product.sku}</div>
                  </td>
                  <td className="py-2 pr-3 text-foreground/60">{product.category.name}</td>
                  <td className="py-2 pr-3 text-foreground/60">{product.pricing?.supplier?.name ?? "—"}</td>
                  <td className="py-2 pr-3">{priceOrDash(product.pricing?.purchasePrice)}</td>
                  <td className="py-2 pr-3">{priceOrDash(product.pricing?.retailPrice)}</td>
                  <td className="py-2 pr-3 font-medium">{formatRub(product.price)}</td>
                  <td className="py-2 pr-3">{priceOrDash(product.pricing?.dealerPrice)}</td>
                  <td className="py-2 pr-3">
                    <StockCell
                      product={product}
                      reserved={reserve[product.id] ?? 0}
                      onReserve={() => setReserveOf(product)}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <ActiveToggle productId={product.id} isActive={product.isActive} />
                  </td>
                  <td className="py-2 pr-2 text-right">
                    <div className="flex justify-end gap-4">
                      <Link
                        href={`/admin/crm/products/${product.id}/edit`}
                        onClick={rememberPlace}
                        className="hover:underline"
                      >
                        Изменить
                      </Link>
                      <DeleteButton
                        action={deleteProduct.bind(null, product.id)}
                        confirmText={`Удалить товар «${product.name}»?`}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CrmTableScroll>
      )}

      {reserveOf && <ReserveDialog product={reserveOf} onClose={() => setReserveOf(null)} />}
    </>
  );
}
