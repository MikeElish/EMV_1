"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  importCounterparties,
  importOneCGoods,
  linkAutomatically,
  resolveProduct,
  type MatchingOverview,
  type SyncResult,
} from "@/actions/admin/onec-sync";
import type { OneCGood } from "@/lib/onec-sync";

const button =
  "rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40";
const ghost =
  "rounded-md border border-foreground/20 px-3 py-1.5 text-sm transition-colors hover:bg-foreground/5 disabled:opacity-40";

function goodLabel(g: OneCGood) {
  return [g.sku && `арт. ${g.sku}`, g.code && `код ${g.code}`, g.name, g.group && `(${g.group})`]
    .filter(Boolean)
    .join(" · ");
}

function Tile({ label, value, tone }: { label: string; value: number; tone?: "warn" | "ok" }) {
  return (
    <div className="rounded-lg border border-foreground/10 p-3">
      <p className="text-xs text-foreground/50">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone === "warn" && value ? "text-amber-600" : tone === "ok" ? "text-green-600" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function AmbiguousRow({
  product,
  candidates,
  run,
  pending,
}: {
  product: { id: string; sku: string; name: string };
  candidates: OneCGood[];
  run: (a: () => Promise<SyncResult>) => void;
  pending: boolean;
}) {
  // Default: all cards -- the same article on several cards is a duplicate in 1С.
  const [choice, setChoice] = useState("__all__");
  return (
    <li className="py-3">
      <p className="text-sm">
        <span className="font-medium">{product.sku}</span> — {product.name}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          aria-label={`Карточка 1С для ${product.sku}`}
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          className="max-w-xl flex-1 rounded-md border border-foreground/20 bg-background px-2 py-1.5 text-sm"
        >
          <option value="__all__">Все {candidates.length} карточки — это дубли одного товара в 1С</option>
          {candidates.map((c) => (
            <option key={c.ref} value={c.ref}>
              Только: {goodLabel(c)}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => resolveProduct(product.id, choice === "__all__" ? candidates.map((c) => c.ref) : [choice]))}
          className={ghost}
        >
          Связать
        </button>
        <button type="button" disabled={pending} onClick={() => run(() => resolveProduct(product.id, null))} className={ghost}>
          В 1С нет
        </button>
      </div>
    </li>
  );
}

export function OneCMatchingBoard({ overview }: { overview: MatchingOverview }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<SyncResult | null>(null);

  function run(action: () => Promise<SyncResult>) {
    setResult(null);
    startTransition(async () => {
      setResult(await action());
      router.refresh();
    });
  }

  if (!overview.ok) return <p className="text-sm text-red-600">{overview.error}</p>;
  const { products: m, counterparties: k } = overview;
  const decisions = m.ambiguous.length + m.byName.length;
  const oneCOnlyCards = m.oneCOnly.reduce((n, g) => n + g.length, 0);

  return (
    <div className="max-w-5xl space-y-10">
      <div>
        <h1 className="text-lg font-semibold">Сопоставление с 1С:Бухгалтерией</h1>
        <p className="mt-1 text-sm text-foreground/60">
          Связывает товары и компании сайта с карточками 1С, чтобы при выгрузке не появились дубли. Товары 1С, которых
          нет на сайте, добавляются неактивными — для распределения по брендам и категориям.
        </p>
        {pending && <p className="mt-2 text-sm text-foreground/50">Выполняется…</p>}
        {result && <p className={`mt-2 text-sm ${result.ok ? "text-green-600" : "text-red-600"}`}>{result.ok ? result.message : result.error}</p>}
      </div>

      <section>
        <h2 className="font-semibold">Товары</h2>
        <p className="mt-1 text-xs text-foreground/50">Товаров в 1С (без услуг и групп): {overview.totalGoods}</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Tile label="Связано" value={m.linked} tone="ok" />
          <Tile label="Свяжутся по артикулу" value={m.auto.length} tone="warn" />
          <Tile label="Нужно решение" value={decisions} tone="warn" />
          <Tile label="Есть только на сайте" value={m.siteOnly} />
          <Tile label="Есть только в 1С (товаров)" value={m.oneCOnly.length} />
        </div>

        <div className="mt-6 space-y-8">
          <div>
            <h3 className="text-sm font-semibold">Шаг 1. Совпадения по артикулу</h3>
            <p className="mt-1 text-sm text-foreground/60">Артикул на сайте совпадает ровно с одной карточкой 1С.</p>
            <button
              type="button"
              disabled={pending || m.auto.length === 0}
              onClick={() => run(linkAutomatically)}
              className={`mt-3 ${button}`}
            >
              Связать автоматически ({m.auto.length})
            </button>
          </div>

          <div>
            <h3 className="text-sm font-semibold">Шаг 2. Нужно ваше решение ({decisions})</h3>
            {decisions === 0 ? (
              <p className="mt-1 text-sm text-foreground/40">Решать нечего.</p>
            ) : (
              <>
                {m.ambiguous.length > 0 && (
                  <>
                    <p className="mt-2 text-sm text-foreground/60">
                      В 1С несколько карточек с таким артикулом — выберите нужную ({m.ambiguous.length}):
                    </p>
                    <ul className="divide-y divide-foreground/10">
                      {m.ambiguous.map((a) => (
                        <AmbiguousRow key={a.product.id} product={a.product} candidates={a.candidates} run={run} pending={pending} />
                      ))}
                    </ul>
                  </>
                )}
                {m.byName.length > 0 && (
                  <>
                    <p className="mt-4 text-sm text-foreground/60">
                      Артикулы разные, но наименование совпадает — это один и тот же товар? ({m.byName.length})
                    </p>
                    <ul className="divide-y divide-foreground/10">
                      {m.byName.map((b) => (
                        <li key={b.product.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                          <div className="min-w-0 flex-1">
                            <p>
                              <span className="text-foreground/50">Сайт:</span> <span className="font-medium">{b.product.sku}</span> —{" "}
                              {b.product.name}
                            </p>
                            <p>
                              <span className="text-foreground/50">1С:</span> {goodLabel(b.good)}
                            </p>
                          </div>
                          <button type="button" disabled={pending} onClick={() => run(() => resolveProduct(b.product.id, [b.good.ref]))} className={ghost}>
                            Это он
                          </button>
                          <button type="button" disabled={pending} onClick={() => run(() => resolveProduct(b.product.id, null))} className={ghost}>
                            Другой товар
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold">
              Шаг 3. Товары, которые есть только в 1С ({m.oneCOnly.length} товаров из {oneCOnlyCards} карточек)
            </h3>
            <p className="mt-1 text-sm text-foreground/60">
              Карточки 1С с одинаковым артикулом объединяются в один товар — приход по любой из них попадёт на него.
              Будут добавлены на сайт неактивными, с ценой 0, в категорию «Из 1С — не распределено». Код 1С, единица
              измерения и группа (если есть) сохранятся в характеристиках товара. Включить товар можно после того, как
              у него появятся цены.
            </p>
            {m.auto.length + decisions > 0 && (
              <p className="mt-1 text-sm text-amber-700">Доступно после шагов 1 и 2 — иначе одинаковые товары задвоятся.</p>
            )}
            <button
              type="button"
              disabled={pending || m.oneCOnly.length === 0 || m.auto.length + decisions > 0}
              onClick={() => run(importOneCGoods)}
              className={`mt-3 ${button}`}
            >
              Добавить на сайт ({m.oneCOnly.length})
            </button>
            {m.oneCOnly.length > 0 && (
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-foreground/60">Показать список</summary>
                <ul className="mt-2 max-h-80 space-y-1 overflow-y-auto text-xs text-foreground/70">
                  {m.oneCOnly.map((group) => (
                    <li key={group[0].ref}>
                      {goodLabel(group[0])}
                      {group.length > 1 && <span className="text-amber-700"> + ещё {group.length - 1} дубл. в 1С</span>}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-semibold">Контрагенты → Компании CRM</h2>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <Tile label="Связано" value={k.linked} tone="ok" />
          <Tile label="Свяжутся по ИНН" value={k.toLink.length} />
          <Tile label="Будут созданы" value={k.toCreate.length} />
        </div>
        <p className="mt-3 text-sm text-foreground/60">
          Роль компании берётся из договоров 1С: есть договор с поставщиком — «Поставщик», иначе — «Клиент». Номер договора
          с покупателем переносится в карточку компании.
        </p>
        <button
          type="button"
          disabled={pending || k.toLink.length + k.toCreate.length === 0}
          onClick={() => run(importCounterparties)}
          className={`mt-3 ${button}`}
        >
          Перенести из 1С ({k.toLink.length + k.toCreate.length})
        </button>
        {k.toCreate.length > 0 && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-foreground/60">Показать список</summary>
            <ul className="mt-2 max-h-80 space-y-1 overflow-y-auto text-xs text-foreground/70">
              {k.toLink.map((l) => (
                <li key={l.ref}>
                  связать: {l.companyName} ← {l.name} (ИНН {l.inn})
                </li>
              ))}
              {k.toCreate.map((c) => (
                <li key={c.ref}>
                  {c.name}
                  {c.inn && ` · ИНН ${c.inn}`} · {c.type}
                  {c.contract && ` · договор ${c.contract}`}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </div>
  );
}
