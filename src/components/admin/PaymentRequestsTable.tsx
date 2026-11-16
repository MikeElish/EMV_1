"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { formatAdminPrice, rublesToKopecksRoundedUp } from "@/lib/money";
import { Modal } from "@/components/Modal";
import { SearchSelect } from "@/components/SearchSelect";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { TableSearchInput } from "@/components/admin/TableSearchInput";
import { CrmTableScroll, STICKY_THEAD } from "@/components/admin/CrmTableFrame";
import { DocumentFileLink } from "@/components/admin/DocumentFileLink";
import {
  deletePaymentRequest,
  getPaymentRequestFormData,
  linkRequestPayment,
  listRequestPayments,
  paymentRequestCompanyByInn,
  savePaymentRequest,
  setPaymentRequestStatus,
  uploadPaymentRequestFile,
  type PaymentRequestFormData,
} from "@/actions/admin/payment-requests";
import { PAYMENT_REQUEST_STATUSES, type PaymentRequestInput } from "@/lib/validators/payment-requests";
import { useRememberedState } from "@/components/admin/AdminPlaces";
import { FUNDS, FUND_LABELS, type Fund } from "@/lib/fund-labels";
import { PAYMENT_PURPOSE_CATEGORIES, PAYMENT_PURPOSE_LABELS } from "@/lib/payment-purpose";
import { formatSupplierCurrency, type SupplierCurrency } from "@/lib/supplier-currency";

export type PaymentRequestRow = {
  id: string;
  number: number;
  createdAt: string;
  managerId: string | null;
  companyId: string | null;
  companyName: string | null;
  inn: string | null;
  orderId: string | null;
  orderNumber: string | null;
  /** Where it came from: a supplier order, an extra cost; null -- by hand. */
  source: string | null;
  amount: number;
  vatPercent: number | null;
  vatAmount: number | null;
  currency: SupplierCurrency;
  currencyAmount: number | null;
  exchangeRate: number | null;
  purpose: string | null;
  purposeCategory: (typeof PAYMENT_PURPOSE_CATEGORIES)[number];
  fund: string;
  status: string;
  paidAt: string | null;
  payment: string | null;
  files: { id: string; kind: string; fileName: string; fileUrl: string }[];
};

const inputClass =
  "mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/50";
const rub = (kopecks: number) => (kopecks ? String(kopecks / 100).replace(".", ",") : "");
const parseRub = (s: string) => {
  const n = parseFloat(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? rublesToKopecksRoundedUp(n) : NaN;
};
const FILE_KINDS: Record<string, string> = { INVOICE: "Счёт", PAYMENT: "Платёжка", OTHER: "Иные" };

const STATUS_STYLES: Record<string, string> = {
  "Требуется оплата": "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  Оплачено: "bg-green-600/10 text-green-700 dark:text-green-500",
  Отменено: "bg-foreground/10 text-foreground/50",
};

function Payments({ request }: { request: PaymentRequestRow }) {
  const [list, setList] = useState<Awaited<ReturnType<typeof listRequestPayments>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    let cancelled = false;
    listRequestPayments(request.id).then((l) => !cancelled && setList(l));
    return () => {
      cancelled = true;
    };
  }, [request.id]);
  if (!list) return <p className="text-sm text-foreground/50">Загрузка платежей...</p>;
  if (!list.length) return <p className="text-sm text-foreground/50">Несвязанных платежей этому получателю в выписках нет.</p>;
  return (
    <div>
      <ul className="space-y-1 text-sm">
        {list.map((t) => (
          <li key={t.id} className="flex items-center gap-3">
            <span className="whitespace-nowrap">{new Date(t.date).toLocaleDateString("ru-RU")}</span>
            <span className="whitespace-nowrap font-medium">{formatAdminPrice(t.amount)}</span>
            <span className="min-w-0 flex-1 truncate text-foreground/60" title={t.purpose ?? ""}>
              {t.documentNumber && `№ ${t.documentNumber} · `}
              {t.purpose}
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await linkRequestPayment(request.id, t.id);
                  if (!r.ok) setError(r.error);
                  else setList([]);
                })
              }
              className="rounded-md border border-foreground/20 px-2 py-1 text-xs hover:bg-foreground/5 disabled:opacity-50"
            >
              Связать
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

function RequestCard({ request, onClose }: { request: PaymentRequestRow | null; onClose: () => void }) {
  const [data, setData] = useState<PaymentRequestFormData | null>(null);
  const [companyId, setCompanyId] = useState(request?.companyId ?? "");
  const [orderId, setOrderId] = useState(request?.orderId ?? "");
  const [fund, setFund] = useState(request?.fund ?? "FREE");
  const [purposeCategory, setPurposeCategory] = useState(request?.purposeCategory ?? "OTHER");
  const [vatPercent, setVatPercent] = useState<number | null>(request?.vatPercent ?? 22);
  const [customVatPercent, setCustomVatPercent] = useState(String(request?.vatPercent ?? ""));
  const [vatAmount, setVatAmount] = useState<number | null>(request?.vatAmount ?? null);
  const [inn, setInn] = useState("");
  const [innNote, setInnNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    getPaymentRequestFormData().then((d) => !cancelled && setData(d));
    return () => {
      cancelled = true;
    };
  }, []);

  const company = data?.companies.find((c) => c.id === companyId);

  function findByInn() {
    setInnNote(null);
    startTransition(async () => {
      const r = await paymentRequestCompanyByInn(inn);
      if (!r.ok) return setInnNote(r.error);
      setData((d) => (d && !d.companies.some((c) => c.id === r.company.id) ? { ...d, companies: [...d.companies, r.company] } : d));
      setCompanyId(r.company.id);
      setInnNote(r.created ? `Добавлена компания «${r.company.name}» (из ЕГРЮЛ)` : `Найдена «${r.company.name}»`);
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = request?.currency !== undefined && request.currency !== "RUB"
      ? request.amount
      : parseRub(String(form.get("amount") ?? ""));
    if (Number.isNaN(amount)) return setError("Укажите сумму");
    const finalVatPercent = vatPercent;
    const finalVatAmount = vatAmount ?? (finalVatPercent !== null && amount > 0 ? Math.round(amount * finalVatPercent / (100 + finalVatPercent)) : null);
    const input: PaymentRequestInput = {
      id: request?.id ?? null,
      companyId: companyId || null,
      orderId: orderId || null,
      amount,
      vatPercent: finalVatPercent,
      vatAmount: finalVatAmount,
      purpose: String(form.get("purpose") ?? ""),
      purposeCategory,
      fund,
    };
    const body = new FormData();
    body.set("data", JSON.stringify(input));
    const file = form.get("file");
    if (file instanceof File && file.size) body.set("file", file);
    setError(null);
    startTransition(async () => {
      const r = await savePaymentRequest(body);
      if (!r.ok) setError(r.error);
      else onClose();
    });
  }

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-3xl">
      <h2 className="text-lg font-semibold">{request ? `Заявка на оплату № ${request.number}` : "Новая заявка на оплату"}</h2>
      {request?.source && <p className="mt-1 text-sm text-foreground/50">{request.source}</p>}
      {!data ? (
        <p className="mt-4 text-sm text-foreground/50">Загрузка...</p>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm text-foreground/60">{request?.managerId ? "Получатель (менеджер)" : "Контрагент *"}</label>
              {request?.managerId ? (
                <p className="mt-1 rounded-md border border-foreground/10 px-3 py-2 text-sm">{request.companyName ?? "Менеджер"}</p>
              ) : (
                <>
                  <SearchSelect
                    value={companyId}
                    onChange={setCompanyId}
                    emptyLabel="— не выбран —"
                    options={data.companies.map((c) => ({ value: c.id, label: c.name, hint: [c.inn && `ИНН ${c.inn}`, c.kpp && `КПП ${c.kpp}`].filter(Boolean).join(" ") }))}
                    className="mt-1"
                  />
                  <div className="mt-2 flex gap-2">
                    <input
                      value={inn}
                      onChange={(e) => setInn(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          findByInn();
                        }
                      }}
                      placeholder="или ИНН"
                      inputMode="numeric"
                      className="w-40 rounded-md border border-foreground/20 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-foreground/50"
                    />
                    <button
                      type="button"
                      onClick={findByInn}
                      disabled={pending || !inn.trim()}
                      className="rounded-md border border-foreground/20 px-3 py-1.5 text-sm hover:bg-foreground/5 disabled:opacity-50"
                    >
                      Найти по ИНН
                    </button>
                  </div>
                  {innNote && <p className="mt-1 text-xs text-foreground/60">{innNote}</p>}
                  {company?.inn && <p className="mt-1 text-xs text-foreground/50">ИНН {company.inn}</p>}
                </>
              )}
            </div>
            <div>
              <label className="text-sm text-foreground/60">Заказ</label>
              <SearchSelect
                value={orderId}
                onChange={setOrderId}
                emptyLabel="— без заказа —"
                options={data.orders.map((o) => ({ value: o.id, label: o.orderNumber, hint: o.customerName }))}
                className="mt-1"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="text-sm text-foreground/60">Сумма, {request?.currency ?? "RUB"} *</label>
              <input
                name="amount"
                defaultValue={request?.currency !== undefined && request.currency !== "RUB"
                  ? rub(request.currencyAmount ?? 0)
                  : rub(request?.amount ?? 0)}
                inputMode="decimal"
                placeholder="0,00"
                disabled={request?.currency !== undefined && request.currency !== "RUB"}
                onChange={(event) => {
                  if (vatPercent === null) return;
                  const amountKopecks = parseRub(event.target.value);
                  if (amountKopecks > 0) {
                    setVatAmount(Math.round(amountKopecks * vatPercent / (100 + vatPercent)));
                  }
                }}
                className={`${inputClass} disabled:opacity-70`}
              />
              {request?.currency !== undefined && request.currency !== "RUB" && (
                <p className="mt-1 text-xs text-foreground/50">
                  Эквивалент для сверки с банковской выпиской: {formatAdminPrice(request.amount)}
                </p>
              )}
            </div>
            <div>
              <label className="text-sm text-foreground/60">НДС %</label>
              <select
                value={vatPercent === null ? "none" : [0, 5, 7, 10, 20, 22, 30].includes(vatPercent) ? String(vatPercent) : "custom"}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === "none") {
                    setVatPercent(null);
                    setVatAmount(null);
                  } else if (value === "custom") {
                    setVatPercent(customVatPercent ? Number(customVatPercent.replace(",", ".")) : null);
                  } else {
                    const percent = Number(value);
                    setVatPercent(percent);
                    const amountInput = document.querySelector<HTMLInputElement>('input[name="amount"]');
                    const amountKopecks = amountInput ? parseRub(amountInput.value) : request?.amount ?? 0;
                    if (amountKopecks > 0) {
                      setVatAmount(Math.round(amountKopecks * percent / (100 + percent)));
                    }
                  }
                }}
                className={inputClass}
              >
                <option value="none">Без НДС</option>
                <option value="0">0%</option>
                <option value="5">5%</option>
                <option value="7">7%</option>
                <option value="10">10%</option>
                <option value="20">20%</option>
                <option value="22">22%</option>
                <option value="30">30%</option>
                <option value="custom">Другое</option>
              </select>
              {vatPercent !== null && ![0, 5, 7, 10, 20, 22, 30].includes(vatPercent) && (
                <input
                  value={customVatPercent}
                  onChange={(event) => {
                    setCustomVatPercent(event.target.value);
                    const percent = Number(event.target.value.replace(",", "."));
                    if (Number.isFinite(percent)) {
                      setVatPercent(percent);
                      const amountInput = document.querySelector<HTMLInputElement>('input[name="amount"]');
                      const amountKopecks = amountInput ? parseRub(amountInput.value) : request?.amount ?? 0;
                      if (amountKopecks > 0) {
                        setVatAmount(Math.round(amountKopecks * percent / (100 + percent)));
                      }
                    }
                  }}
                  placeholder="%"
                  inputMode="decimal"
                  className={`${inputClass} mt-2`}
                />
              )}
            </div>
            <div>
              <label className="text-sm text-foreground/60">Сумма НДС</label>
              <input
                value={vatAmount === null ? "" : rub(vatAmount)}
                onChange={(event) => {
                  const value = parseRub(event.target.value);
                  if (!Number.isNaN(value)) {
                    setVatAmount(value);
                    const amountInput = document.querySelector<HTMLInputElement>('input[name="amount"]');
                    const amountKopecks = amountInput ? parseRub(amountInput.value) : request?.amount ?? 0;
                    if (amountKopecks > 0) {
                      setVatPercent(Number((value * 100 / (amountKopecks - value)).toFixed(2)));
                    }
                  }
                }}
                inputMode="decimal"
                placeholder="0,00"
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-sm text-foreground/60">Категория *</label>
              <SearchSelect
                value={purposeCategory}
                onChange={(value) => setPurposeCategory(value as typeof purposeCategory)}
                options={PAYMENT_PURPOSE_CATEGORIES.map((category) => ({
                  value: category,
                  label: PAYMENT_PURPOSE_LABELS[category],
                }))}
                className="mt-1"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm text-foreground/60">Назначение</label>
              <input name="purpose" defaultValue={request?.purpose ?? ""} className={inputClass} />
            </div>
          </div>
          <div className="max-w-sm">
            <label className="text-sm text-foreground/60">Фонд *</label>
            <SearchSelect
              value={fund}
              onChange={setFund}
              options={FUNDS.map((value) => ({ value, label: FUND_LABELS[value] }))}
              className="mt-1"
            />
            <p className="mt-1 text-xs text-foreground/50">Оплатить заявку можно, только если в фонде хватает денег (Финансы → Фонды).</p>
          </div>
          <div>
            <label className="text-sm text-foreground/60">Счёт (файл)</label>
            <input name="file" type="file" className="mt-2 block w-full text-sm" />
          </div>

          {request && request.status === "Требуется оплата" && (
            <div>
              <p className="text-sm text-foreground/60">Платежи из выписок этому получателю</p>
              <div className="mt-1">
                <Payments request={request} />
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-md border border-foreground/20 px-4 py-2 text-sm">
              Отмена
            </button>
            <button type="submit" disabled={pending} className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50">
              {pending ? "Сохраняем..." : "Сохранить"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function StatusSelect({ request }: { request: PaymentRequestRow }) {
  const [pending, startTransition] = useTransition();
  return (
    <>
    <select
      value={request.status}
      disabled={pending}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        const next = e.target.value;
        startTransition(async () => {
          const r = await setPaymentRequestStatus(request.id, next);
          if (!r.ok) alert(r.error);
        });
      }}
      className={`rounded-full border-0 px-2 py-0.5 text-xs font-medium outline-none ${STATUS_STYLES[request.status] ?? ""}`}
    >
      {PAYMENT_REQUEST_STATUSES.map((s) => (
        <option key={s}>{s}</option>
      ))}
    </select>
    <div className="mt-0.5 text-[11px] text-foreground/50">{FUND_LABELS[request.fund as Fund] ?? FUND_LABELS.FREE}</div>
    </>
  );
}

function AddFileButton({
  id,
  kind,
  label,
}: {
  id: string;
  kind: string;
  label: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <label className={`cursor-pointer text-xs text-blue-600 hover:underline dark:text-blue-400 ${pending ? "opacity-50" : ""}`} onClick={(e) => e.stopPropagation()}>
      + {label}
      <input
        type="file"
        className="hidden"
        disabled={pending}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const body = new FormData();
          body.set("id", id);
          body.set("kind", kind);
          body.set("file", file);
          startTransition(async () => {
            const r = await uploadPaymentRequestFile(body);
            if (!r.ok) alert(r.error);
          });
        }}
      />
    </label>
  );
}

function AddFile({ id }: { id: string }) {
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1">
      <AddFileButton id={id} kind="INVOICE" label="счёт" />
      <AddFileButton id={id} kind="PAYMENT" label="платёжка" />
      <AddFileButton id={id} kind="OTHER" label="иные" />
    </span>
  );
}

export function PaymentRequestsTable({ requests }: { requests: PaymentRequestRow[] }) {
  const [search, setSearch] = useRememberedState("search", "");
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [editing, setEditing] = useState<PaymentRequestRow | "new" | null>(null);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only preference, read after hydration
      if (localStorage.getItem("payment-requests:only-open") === "0") setOnlyOpen(false);
    } catch {
      // storage unavailable
    }
  }, []);
  function toggleOpen(value: boolean) {
    setOnlyOpen(value);
    try {
      localStorage.setItem("payment-requests:only-open", value ? "1" : "0");
    } catch {
      // storage unavailable
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter(
      (r) =>
        (!onlyOpen || r.status === "Требуется оплата") &&
        (!q || [r.number, r.companyName, r.inn, r.orderNumber, r.source, PAYMENT_PURPOSE_LABELS[r.purposeCategory], r.purpose, r.status].filter(Boolean).join(" ").toLowerCase().includes(q))
    );
  }, [requests, search, onlyOpen]);
  const total = filtered.reduce((s, r) => s + (r.status === "Требуется оплата" ? r.amount : 0), 0);

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setEditing("new")}
          aria-label="Новая заявка"
          className="flex h-8 w-8 items-center justify-center rounded-md bg-green-600 text-lg font-bold leading-none text-white transition-opacity hover:opacity-90"
        >
          +
        </button>
        <h1 className="text-lg font-semibold">Заявки на оплату</h1>
        <span className="text-sm text-foreground/50">к оплате {formatAdminPrice(total)}</span>
        <label className="flex items-center gap-1.5 text-sm text-foreground/70">
          <input type="checkbox" checked={onlyOpen} onChange={(e) => toggleOpen(e.target.checked)} />
          Только неоплаченные
        </label>
        <div className="ml-auto">
          <TableSearchInput value={search} onChange={setSearch} placeholder="Поиск..." />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-6 text-sm text-foreground/40">
          {requests.length ? "Нет заявок по фильтру." : "Заявок пока нет: они появятся из счетов поставщиков и доп.расходов, или добавьте зелёным «+»."}
        </p>
      ) : (
        <CrmTableScroll className="mt-4">
          <table className="w-full text-sm">
            <thead className={STICKY_THEAD}>
              <tr className="text-left text-foreground/50">
                <th className="py-2 pr-4">№</th>
                <th className="py-2 pr-4">Контрагент</th>
                <th className="py-2 pr-4">ИНН</th>
                <th className="py-2 pr-4">Заказ</th>
                <th className="py-2 pr-4 text-right">Сумма</th>
                <th className="py-2 pr-4">Статус</th>
                <th className="py-2 pr-4">Файлы</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} onClick={() => setEditing(r)} className="cursor-pointer border-b border-foreground/10 align-top hover:bg-foreground/5">
                  <td className="whitespace-nowrap py-2 pr-4">
                    <div>{r.number}</div>
                    <div className="text-xs text-foreground/50">{new Date(r.createdAt).toLocaleDateString("ru-RU")}</div>
                  </td>
                  <td className="py-2 pr-4">
                    <div>{r.companyName ?? "—"}</div>
                    <div className="text-xs text-foreground/50">{[PAYMENT_PURPOSE_LABELS[r.purposeCategory], r.source, r.purpose].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td className="py-2 pr-4">{r.inn ?? ""}</td>
                  <td className="whitespace-nowrap py-2 pr-4">{r.orderNumber ?? "—"}</td>
                  <td className="whitespace-nowrap py-2 pr-4 text-right">
                    {r.currency !== "RUB" && r.currencyAmount !== null
                      ? formatSupplierCurrency(r.currencyAmount, r.currency)
                      : formatAdminPrice(r.amount)}
                    {r.currency !== "RUB" && <div className="text-xs text-foreground/50">{formatAdminPrice(r.amount)} экв.</div>}
                    {r.vatAmount !== null && r.vatAmount > 0 && (
                      <div className="text-xs text-foreground/50">
                        НДС {r.vatPercent ?? 0}%: {formatAdminPrice(r.vatAmount)}
                      </div>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    <StatusSelect request={r} />
                    {r.payment && <div className="mt-1 text-xs text-foreground/50">{r.payment}</div>}
                  </td>
                  <td className="max-w-56 py-2 pr-4">
                    {r.files.map((f) => (
                      <span key={f.id} className="block truncate" onClick={(e) => e.stopPropagation()}>
                        {FILE_KINDS[f.kind] ?? "Файл"}:{" "}
                        <DocumentFileLink
                          fileUrl={f.fileUrl}
                          fileName={f.fileName}
                          onClick={(e) => e.stopPropagation()}
                          forcePreview
                          className="text-blue-600 hover:underline dark:text-blue-400"
                        />
                      </span>
                    ))}
                    <AddFile id={r.id} />
                  </td>
                  <td className="py-2" onClick={(e) => e.stopPropagation()}>
                    {!r.source && (
                      <DeleteButton action={() => deletePaymentRequest(r.id)} confirmText="Удалить заявку?" className="text-red-600 hover:underline disabled:opacity-50" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CrmTableScroll>
      )}

      {editing && <RequestCard request={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
