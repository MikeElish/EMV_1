import "server-only";
import { revalidatePath } from "next/cache";
import { OrderStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createManualOrderRecord } from "@/lib/manual-order";
import { applyMarkup } from "@/lib/pricing";
import { findCanonicalBrand } from "@/lib/normalize-brand";
import { setLineStatuses } from "@/lib/order-status";
import { getWarehouseData, balances } from "@/lib/onec-warehouse";
import { ORDER_STATUS_LABELS } from "@/lib/validators/orders";
import { COMPANY_PRICE_TYPE, PRICE_TYPE_LABELS, type PriceType } from "@/lib/validators/manual-order";

// What Claude can do on the site through the connector (src/app/api/mcp).
// Only the owner gets here. Money goes in and out in rubles; the database
// keeps kopecks.

type Args = Record<string, unknown>;
type Tool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  readOnly?: boolean;
  run: (args: Args) => Promise<unknown>;
};

class ToolError extends Error {}

const rub = (kopecks: number) => Math.round(kopecks) / 100;
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const limitOf = (v: unknown, max: number, fallback: number) =>
  typeof v === "number" && v > 0 ? Math.min(Math.floor(v), max) : fallback;

/** Every word in the name, article or brand; an article typed with dashes also matches without them. */
function productWhere(query: string): Prisma.ProductWhereInput {
  const words = query.split(/\s+/).filter(Boolean).slice(0, 6);
  return {
    AND: words.map((word) => {
      const bare = word.replace(/[-.\/_\\\s]/g, "");
      return {
        OR: [
          { name: { contains: word, mode: "insensitive" } },
          { sku: { contains: word, mode: "insensitive" } },
          { brand: { contains: word, mode: "insensitive" } },
          ...(bare !== word && bare.length >= 3 ? [{ sku: { contains: bare, mode: "insensitive" as const } }] : []),
        ],
      };
    }),
  };
}

const productSelect = {
  id: true,
  sku: true,
  name: true,
  brand: true,
  stock: true,
  isActive: true,
  price: true,
  category: { select: { name: true } },
  pricing: { select: { purchasePrice: true, retailPrice: true, dealerPrice: true } },
} satisfies Prisma.ProductSelect;
type ProductRow = Prisma.ProductGetPayload<{ select: typeof productSelect }>;

/** Same as the «Новый заказ» window: «Индивидуальный» = purchase + the company's markup. */
function priceFor(p: ProductRow, type: PriceType, markup: number | null): number {
  const prices = { retail: p.pricing?.retailPrice ?? p.price, wholesale: p.price, dealer: p.pricing?.dealerPrice ?? p.price };
  if (type !== "individual") return prices[type];
  const purchase = p.pricing?.purchasePrice ?? 0;
  return purchase > 0 && markup !== null && p.price > 0 ? applyMarkup(purchase, markup) : p.price;
}

function productOut(p: ProductRow) {
  return {
    product_id: p.id,
    sku: p.sku,
    name: p.name,
    brand: p.brand,
    category: p.category.name,
    on_site: p.isActive,
    stock: p.stock,
    prices_rub: p.price > 0 ? { retail: rub(p.pricing?.retailPrice ?? p.price), wholesale: rub(p.price), dealer: rub(p.pricing?.dealerPrice ?? p.price) } : "По запросу",
    purchase_rub: p.pricing?.purchasePrice ? rub(p.pricing.purchasePrice) : null,
  };
}

async function productBySku(ref: string): Promise<ProductRow | null> {
  const exact = await prisma.product.findFirst({
    where: { OR: [{ id: ref }, { sku: { equals: ref, mode: "insensitive" } }] },
    select: productSelect,
  });
  if (exact) return exact;
  const bare = ref.replace(/[-.\/_\\\s]/g, "");
  return bare === ref ? null : prisma.product.findFirst({ where: { sku: { equals: bare, mode: "insensitive" } }, select: productSelect });
}

async function orderByNumber(number: string) {
  const order = await prisma.order.findFirst({
    where: { orderNumber: { equals: number.replace(/^№\s*/, ""), mode: "insensitive" } },
    include: { items: { include: { product: { select: { sku: true } } }, orderBy: { id: "asc" } } },
  });
  if (!order) throw new ToolError(`Заказ ${number} не найден`);
  return order;
}

function orderOut(order: Awaited<ReturnType<typeof orderByNumber>>) {
  return {
    order_number: order.orderNumber,
    date: order.createdAt.toISOString().slice(0, 10),
    customer: order.customerName,
    phone: order.customerPhone,
    email: order.customerEmail,
    delivery_note: order.deliveryNote,
    status: ORDER_STATUS_LABELS[order.status],
    paid: order.paid,
    deferred_payment: order.deferred,
    total_rub: rub(order.totalAmount),
    lines: order.items.map((i) => ({
      sku: i.product?.sku,
      name: i.nameSnapshot,
      quantity: i.quantity,
      price_rub: rub(i.priceSnapshot),
      status: ORDER_STATUS_LABELS[i.status],
      paid: i.paid,
    })),
  };
}

const STATUS_KEYS = Object.keys(ORDER_STATUS_LABELS) as OrderStatus[];
const statusList = STATUS_KEYS.map((s) => `${s} — «${ORDER_STATUS_LABELS[s]}»`).join("; ");

export const TOOLS: Tool[] = [
  {
    name: "search_products",
    description:
      "Поиск товаров EMV по артикулу, названию или бренду (все слова запроса должны найтись). Возвращает id, артикул, бренд, категорию, наличие на складе, цены (розница/опт/дилер, ₽) и закупку. Ищет и среди скрытых с сайта товаров.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Артикул, часть названия или бренд" },
        only_on_site: { type: "boolean", description: "Только товары, открытые на сайте" },
        limit: { type: "number", description: "Сколько вернуть, до 50 (по умолчанию 15)" },
      },
      required: ["query"],
    },
    readOnly: true,
    async run(args) {
      const query = str(args.query);
      if (!query) throw new ToolError("Пустой запрос");
      const where = productWhere(query);
      if (args.only_on_site) where.isActive = true;
      const rows = await prisma.product.findMany({
        where,
        select: productSelect,
        orderBy: [{ isActive: "desc" }, { stock: "desc" }, { name: "asc" }],
        take: limitOf(args.limit, 50, 15),
      });
      return { found: rows.length, products: rows.map(productOut) };
    },
  },
  {
    name: "find_clients",
    description:
      "Поиск клиентов: покупатели с учётной записью на сайте и компании-клиенты (по названию, ИНН, ФИО, e-mail, телефону). Возвращает client_id для create_order, тип цен, наценку и условия оплаты.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "Название, ИНН, ФИО, e-mail или телефон" } },
      required: ["query"],
    },
    readOnly: true,
    async run(args) {
      const q = str(args.query);
      if (!q) throw new ToolError("Пустой запрос");
      const like = { contains: q, mode: "insensitive" as const };
      const [users, companies] = await Promise.all([
        prisma.user.findMany({
          where: {
            role: "CUSTOMER",
            OR: [{ lastName: like }, { firstName: like }, { email: like }, { phone: like }, { login: like }, { company: { name: like } }],
          },
          select: { id: true, lastName: true, firstName: true, patronymic: true, email: true, phone: true, company: true },
          take: 20,
        }),
        prisma.company.findMany({
          where: { isOwn: false, OR: [{ type: null }, { type: { not: "Поставщик" } }], AND: [{ OR: [{ name: like }, { inn: like }] }] },
          take: 20,
        }),
      ]);
      const terms = (c: { priceType: keyof typeof COMPANY_PRICE_TYPE; individualMarkup: number | null; paymentType: string; paymentDeferralDays: number | null } | null) => ({
        price_type: PRICE_TYPE_LABELS[COMPANY_PRICE_TYPE[c?.priceType ?? "WHOLESALE"]],
        markup_percent: c?.priceType === "INDIVIDUAL" ? c.individualMarkup : null,
        payment: c?.paymentType === "DEFERRED" ? `Отсрочка${c.paymentDeferralDays ? ` ${c.paymentDeferralDays} дн.` : ""}` : "Предоплата",
      });
      return {
        customers: users.map((u) => ({
          client_id: u.id,
          kind: "Покупатель (учётная запись на сайте)",
          name: [u.lastName, u.firstName, u.patronymic].filter(Boolean).join(" "),
          company: u.company?.name ?? null,
          email: u.email,
          phone: u.phone,
          ...terms(u.company),
        })),
        companies: companies.map((c) => ({ client_id: c.id, kind: "Компания", name: c.name, inn: c.inn, ...terms(c) })),
      };
    },
  },
  {
    name: "create_order",
    description:
      "Создаёт заказ в CRM, как окно «Новый заказ». Цены по умолчанию — по типу цен клиента (без клиента — розница), их можно задать вручную. Статусы строк ставятся сами (наличие, оплата, отсрочка); недостающее уходит в заказы поставщикам. Сначала вызывайте с preview=true и покажите пользователю результат; создавайте после его подтверждения.",
    inputSchema: {
      type: "object",
      properties: {
        client_id: { type: "string", description: "client_id из find_clients (покупатель или компания). Без него — разовый покупатель" },
        customer_name: { type: "string", description: "Покупатель (для компании по умолчанию её название)" },
        phone: { type: "string", description: "Телефон (обязателен, если его нет у клиента)" },
        email: { type: "string", description: "E-mail (обязателен, если его нет у клиента)" },
        delivery_note: { type: "string", description: "Доставка / комментарий" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              sku: { type: "string", description: "Артикул или product_id" },
              quantity: { type: "number" },
              price_rub: { type: "number", description: "Цена за штуку, ₽ — если не по прайсу клиента" },
            },
            required: ["sku", "quantity"],
          },
        },
        preview: { type: "boolean", description: "true — только показать, что получится, без создания" },
      },
      required: ["items"],
    },
    async run(args) {
      const clientId = str(args.client_id);
      let customerId: string | undefined;
      let companyId: string | undefined;
      let name = str(args.customer_name);
      let phone = str(args.phone);
      let email = str(args.email);
      let priceType: PriceType = "retail";
      let markup: number | null = null;

      if (clientId) {
        const user = await prisma.user.findFirst({ where: { id: clientId, role: "CUSTOMER" }, include: { company: true } });
        const company = user ? null : await prisma.company.findUnique({ where: { id: clientId }, include: { users: true } });
        if (user) {
          customerId = user.id;
          name ||= [user.lastName, user.firstName, user.patronymic].filter(Boolean).join(" ") || user.login;
          phone ||= user.phone ?? "";
          email ||= user.email ?? "";
          priceType = COMPANY_PRICE_TYPE[user.company?.priceType ?? "WHOLESALE"];
          markup = user.company?.individualMarkup ?? null;
        } else if (company) {
          companyId = company.id;
          name ||= company.name;
          // A company has no contacts of its own: those of its people or of its last order.
          const last = await prisma.order.findFirst({ where: { customerName: company.name }, orderBy: { createdAt: "desc" } });
          const person = company.users.find((u) => u.email);
          phone ||= person?.phone ?? last?.customerPhone ?? "";
          email ||= person?.email ?? last?.customerEmail ?? "";
          priceType = COMPANY_PRICE_TYPE[company.priceType];
          markup = company.individualMarkup;
        } else throw new ToolError("Клиент не найден — возьмите client_id из find_clients");
      }
      if (priceType === "individual" && markup === null) priceType = "wholesale";

      const rawItems = Array.isArray(args.items) ? (args.items as Args[]) : [];
      if (!rawItems.length) throw new ToolError("Нет позиций");
      const missing: string[] = [];
      const lines: { product: ProductRow; quantity: number; price: number }[] = [];
      for (const item of rawItems) {
        const product = await productBySku(str(item.sku));
        if (!product) {
          missing.push(str(item.sku));
          continue;
        }
        const quantity = Math.floor(Number(item.quantity));
        if (!(quantity >= 1)) throw new ToolError(`Количество для ${product.sku} должно быть не меньше 1`);
        const manual = typeof item.price_rub === "number" ? Math.round(item.price_rub * 100) : null;
        lines.push({ product, quantity, price: manual ?? priceFor(product, priceType, markup) });
      }
      if (missing.length) throw new ToolError(`Не найдены артикулы: ${missing.join(", ")}. Проверьте через search_products`);

      const summary = {
        customer: name,
        phone,
        email,
        price_type: PRICE_TYPE_LABELS[priceType],
        delivery_note: str(args.delivery_note) || null,
        lines: lines.map((l) => ({
          sku: l.product.sku,
          name: l.product.name,
          quantity: l.quantity,
          price_rub: rub(l.price),
          sum_rub: rub(l.price * l.quantity),
          in_stock: l.product.stock,
          ...(l.price === 0 ? { warning: "Цена 0 (По запросу) — укажите price_rub" } : {}),
        })),
        total_rub: rub(lines.reduce((s, l) => s + l.price * l.quantity, 0)),
      };
      const lacking = [!name && "имя покупателя", !phone && "телефон", !email && "e-mail"].filter(Boolean);
      if (args.preview) return { preview: true, ...summary, ...(lacking.length ? { needs: lacking } : {}) };
      if (lacking.length) throw new ToolError(`Укажите: ${lacking.join(", ")}`);

      const result = await createManualOrderRecord({
        customerId,
        companyId,
        customerName: name,
        customerPhone: phone,
        customerEmail: email,
        deliveryNote: str(args.delivery_note) || undefined,
        items: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity, price: l.price })),
      });
      if (!result.ok) throw new ToolError(result.error);
      return orderOut(await orderByNumber(result.orderNumber));
    },
  },
  {
    name: "list_orders",
    description: "Список заказов CRM, новые сверху: поиск по номеру, покупателю, телефону, e-mail; можно только незавершённые.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        unfinished_only: { type: "boolean", description: "Без «Завершено» и «Отменено»" },
        limit: { type: "number", description: "До 100 (по умолчанию 20)" },
      },
    },
    readOnly: true,
    async run(args) {
      const q = str(args.query);
      const like = { contains: q, mode: "insensitive" as const };
      const orders = await prisma.order.findMany({
        where: {
          ...(q ? { OR: [{ orderNumber: like }, { customerName: like }, { customerPhone: like }, { customerEmail: like }] } : {}),
          ...(args.unfinished_only ? { status: { notIn: ["DONE", "CANCELLED"] as OrderStatus[] } } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: limitOf(args.limit, 100, 20),
        include: { _count: { select: { items: true } } },
      });
      return orders.map((o) => ({
        order_number: o.orderNumber,
        date: o.createdAt.toISOString().slice(0, 10),
        customer: o.customerName,
        status: ORDER_STATUS_LABELS[o.status],
        total_rub: rub(o.totalAmount),
        lines: o._count.items,
        paid: o.paid,
      }));
    },
  },
  {
    name: "get_order",
    description: "Заказ целиком: покупатель, контакты, строки с артикулами, ценами и статусами.",
    inputSchema: { type: "object", properties: { order_number: { type: "string" } }, required: ["order_number"] },
    readOnly: true,
    async run(args) {
      return orderOut(await orderByNumber(str(args.order_number)));
    },
  },
  {
    name: "set_order_status",
    description: `Меняет статус строк заказа (всех неотменённых или только указанных артикулов), как в CRM: отгрузка списывает со склада, клиенту уходит письмо о новом статусе. Статусы: ${statusList}.`,
    inputSchema: {
      type: "object",
      properties: {
        order_number: { type: "string" },
        status: { type: "string", enum: STATUS_KEYS },
        skus: { type: "array", items: { type: "string" }, description: "Только эти артикулы; без них — весь заказ" },
      },
      required: ["order_number", "status"],
    },
    async run(args) {
      const status = str(args.status) as OrderStatus;
      if (!STATUS_KEYS.includes(status)) throw new ToolError(`Неизвестный статус. Допустимы: ${statusList}`);
      const order = await orderByNumber(str(args.order_number));
      const skus = Array.isArray(args.skus) ? args.skus.map((s) => str(s).toLowerCase()).filter(Boolean) : [];
      const lines = order.items.filter((i) =>
        skus.length ? skus.includes((i.product?.sku ?? "").toLowerCase()) : !i.cancelled || status === "CANCELLED"
      );
      if (!lines.length) throw new ToolError("В заказе нет таких строк");
      await setLineStatuses(order.id, lines.map((i) => ({ itemId: i.id, status })), { notify: true });
      for (const path of ["/admin/crm/orders", "/admin/crm/products", "/shop/orders", "/admin/crm/supplier-orders"]) revalidatePath(path);
      return orderOut(await orderByNumber(order.orderNumber));
    },
  },
  {
    name: "list_categories",
    description: "Категории каталога (для update_product): название, адрес, открыта ли на сайте, сколько товаров.",
    inputSchema: { type: "object", properties: {} },
    readOnly: true,
    async run() {
      const rows = await prisma.category.findMany({
        select: { name: true, slug: true, isActive: true, parent: { select: { name: true } }, _count: { select: { products: true } } },
        orderBy: { name: "asc" },
      });
      return rows.map((c) => ({ name: c.name, slug: c.slug, parent: c.parent?.name ?? null, on_site: c.isActive, products: c._count.products }));
    },
  },
  {
    name: "update_product",
    description:
      "Правит карточку товара: бренд (только из справочника брендов сайта), название, категорию (slug или название из list_categories), показ на сайте. Цены здесь не меняются.",
    inputSchema: {
      type: "object",
      properties: {
        sku: { type: "string", description: "Артикул или product_id" },
        brand: { type: "string" },
        name: { type: "string" },
        category: { type: "string" },
        on_site: { type: "boolean" },
      },
      required: ["sku"],
    },
    async run(args) {
      const product = await productBySku(str(args.sku));
      if (!product) throw new ToolError(`Товар ${str(args.sku)} не найден`);
      const data: Prisma.ProductUncheckedUpdateInput = {};
      if (str(args.brand)) {
        const brand = findCanonicalBrand(str(args.brand));
        if (!brand) throw new ToolError(`Бренда «${str(args.brand)}» нет в справочнике брендов сайта — его добавляют в коде (src/content/brands.ts)`);
        data.brand = brand;
      }
      if (str(args.name)) data.name = str(args.name).slice(0, 300);
      let categoryActive = true;
      if (str(args.category)) {
        const c = str(args.category);
        const category = await prisma.category.findFirst({ where: { OR: [{ slug: c }, { name: { equals: c, mode: "insensitive" } }] } });
        if (!category) throw new ToolError(`Категория «${c}» не найдена — см. list_categories`);
        data.categoryId = category.id;
        categoryActive = category.isActive;
      } else {
        categoryActive = (await prisma.category.findFirst({ where: { products: { some: { id: product.id } } } }))?.isActive ?? true;
      }
      if (typeof args.on_site === "boolean") {
        if (args.on_site && !categoryActive) throw new ToolError("Категория товара скрыта с сайта — сначала выберите открытую категорию");
        data.isActive = args.on_site;
      }
      if (!Object.keys(data).length) throw new ToolError("Нечего менять");
      await prisma.product.update({ where: { id: product.id }, data });
      for (const path of ["/admin/crm/products", "/shop"]) revalidatePath(path);
      return productOut((await productBySku(product.id))!);
    },
  },
  {
    name: "warehouse_stock",
    description: "Остатки по складам 1С (Основной склад, Офис …) по документам 1С: поиск по названию или артикулу.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" }, limit: { type: "number", description: "До 100 (по умолчанию 30)" } },
      required: ["query"],
    },
    readOnly: true,
    async run(args) {
      const words = str(args.query).toLowerCase().split(/\s+/).filter(Boolean);
      if (!words.length) throw new ToolError("Пустой запрос");
      const data = await getWarehouseData();
      const perWarehouse = data.warehouses.map((w) => ({ w, totals: balances(data.movements, w.ref) }));
      const rows = Object.entries(data.items)
        .filter(([, item]) => words.every((word) => `${item.name} ${item.sku}`.toLowerCase().includes(word)))
        .map(([ref, item]) => ({
          sku: item.sku,
          name: item.name,
          warehouses: Object.fromEntries(perWarehouse.map(({ w, totals }) => [w.name, totals.get(ref) ?? 0]).filter(([, n]) => n !== 0)),
        }))
        .slice(0, limitOf(args.limit, 100, 30));
      return { loaded_at: data.loadedAt, items: rows };
    },
  },
];

export async function runTool(name: string, args: Args) {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return { isError: true, content: [{ type: "text", text: `Нет инструмента ${name}` }] };
  try {
    const result = await tool.run(args ?? {});
    return { content: [{ type: "text", text: JSON.stringify(result, null, 1) }] };
  } catch (error) {
    if (!(error instanceof ToolError)) console.error("[mcp]", name, error);
    return { isError: true, content: [{ type: "text", text: error instanceof ToolError ? error.message : "Ошибка на сервере" }] };
  }
}
