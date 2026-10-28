"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { retryReceipt, saveCashboxSettings, testAtol, testSbp, type ActionResult } from "@/actions/admin/cashbox-settings";
import { formatRub } from "@/lib/money";

const inputClassName = "w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-foreground/50";

const SNO: Record<string, string> = {
  osn: "ОСН",
  usn_income: "УСН доходы",
  usn_income_outcome: "УСН доходы минус расходы",
  esn: "ЕСХН",
  patent: "Патент",
};
const VAT: Record<string, string> = {
  vat22: "НДС 22%",
  vat20: "НДС 20%",
  vat10: "НДС 10%",
  vat5: "НДС 5%",
  vat7: "НДС 7%",
  vat0: "НДС 0%",
  none: "Без НДС",
};
const PAYMENT_STATUS: Record<string, string> = { PENDING: "Ожидает оплаты", SUCCEEDED: "Оплачен", CANCELED: "Отменён / истёк", WAITING_FOR_CAPTURE: "Удержан" };
const RECEIPT_KIND: Record<string, string> = { PREPAYMENT: "Предоплата 100%", FULL_PAYMENT: "Полный расчёт" };
const RECEIPT_STATUS: Record<string, string> = { new: "Не отправлен", wait: "В обработке", done: "Пробит", fail: "Ошибка" };

type Initial = {
  atolLogin: string;
  hasPassword: boolean;
  atolGroupCode: string;
  sno: string;
  vat: string;
  inn: string;
  email: string;
  paymentAddress: string;
  receiptsEnabled: boolean;
  sbpEnabled: boolean;
  bankAccountId: string;
  merchantId: string | null;
};

export function CashboxSettingsForm({
  initial,
  accounts,
  payments,
  receipts,
}: {
  initial: Initial;
  accounts: { id: string; label: string }[];
  payments: { id: string; orderNumber: string; amount: number; status: string; createdAt: string; paidAt: string | null }[];
  receipts: { id: string; orderNumber: string; kind: string; amount: number; status: string; error: string | null; createdAt: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [receiptsEnabled, setReceiptsEnabled] = useState(initial.receiptsEnabled);
  const [sbpEnabled, setSbpEnabled] = useState(initial.sbpEnabled);

  async function run(name: string, action: () => Promise<ActionResult>) {
    setBusy(name);
    setResult(null);
    const r = await action();
    setBusy(null);
    setResult(r);
    if (r.ok) router.refresh();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const get = (k: string) => String(form.get(k) ?? "");
    void run("save", () =>
      saveCashboxSettings({
        atolLogin: get("atolLogin"),
        atolPassword: get("atolPassword"),
        atolGroupCode: get("atolGroupCode"),
        sno: get("sno") as never,
        vat: get("vat") as never,
        inn: get("inn"),
        email: get("email"),
        paymentAddress: get("paymentAddress"),
        receiptsEnabled,
        sbpEnabled,
        bankAccountId: get("bankAccountId"),
      })
    );
  }

  return (
    <div>
      <h1 className="text-lg font-semibold">Касса и СБП</h1>
      <p className="mt-1 max-w-2xl text-sm text-foreground/60">
        Частное лицо оплачивает заказ по СБП на странице заказа (платёжная ссылка Точки). Оплата отмечает позиции оплаченными, онлайн-касса
        АТОЛ пробивает чек «Предоплата 100%», при выдаче — «Полный расчёт». Компании по-прежнему платят по счёту.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 max-w-2xl space-y-6">
        <fieldset className="space-y-4 rounded-lg border border-foreground/10 p-4">
          <legend className="px-1 text-sm font-medium">Онлайн-касса АТОЛ Онлайн</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={receiptsEnabled} onChange={(e) => setReceiptsEnabled(e.target.checked)} />
            Пробивать чеки
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="atolLogin" className="text-sm text-foreground/60">Логин</label>
              <input id="atolLogin" name="atolLogin" autoComplete="off" defaultValue={initial.atolLogin} className={`mt-1 ${inputClassName}`} />
            </div>
            <div>
              <label htmlFor="atolPassword" className="text-sm text-foreground/60">Пароль</label>
              <input
                id="atolPassword"
                name="atolPassword"
                type="password"
                autoComplete="new-password"
                placeholder={initial.hasPassword ? "•••••••• (сохранён)" : ""}
                className={`mt-1 ${inputClassName}`}
              />
            </div>
            <div>
              <label htmlFor="atolGroupCode" className="text-sm text-foreground/60">Код группы касс</label>
              <input id="atolGroupCode" name="atolGroupCode" autoComplete="off" defaultValue={initial.atolGroupCode} className={`mt-1 ${inputClassName}`} />
            </div>
          </div>
          <p className="-mt-2 text-xs text-foreground/50">Личный кабинет АТОЛ Онлайн → Настройки интеграции (файл настроек): логин, пароль и group_code.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="sno" className="text-sm text-foreground/60">Система налогообложения</label>
              <select id="sno" name="sno" defaultValue={initial.sno} className={`mt-1 ${inputClassName}`}>
                {Object.entries(SNO).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="vat" className="text-sm text-foreground/60">НДС товаров</label>
              <select id="vat" name="vat" defaultValue={initial.vat} className={`mt-1 ${inputClassName}`}>
                {Object.entries(VAT).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="inn" className="text-sm text-foreground/60">ИНН продавца</label>
              <input id="inn" name="inn" inputMode="numeric" defaultValue={initial.inn} className={`mt-1 ${inputClassName}`} />
            </div>
            <div>
              <label htmlFor="email" className="text-sm text-foreground/60">E-mail магазина в чеке</label>
              <input id="email" name="email" type="email" defaultValue={initial.email} className={`mt-1 ${inputClassName}`} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="paymentAddress" className="text-sm text-foreground/60">Место расчётов (адрес сайта)</label>
              <input id="paymentAddress" name="paymentAddress" defaultValue={initial.paymentAddress} className={`mt-1 ${inputClassName}`} />
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-4 rounded-lg border border-foreground/10 p-4">
          <legend className="px-1 text-sm font-medium">Оплата по СБП (Точка, интернет-эквайринг)</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={sbpEnabled} onChange={(e) => setSbpEnabled(e.target.checked)} />
            Принимать оплату по СБП на сайте
          </label>
          <div>
            <label htmlFor="bankAccountId" className="text-sm text-foreground/60">Счёт Точки (его токен)</label>
            <select id="bankAccountId" name="bankAccountId" defaultValue={initial.bankAccountId} className={`mt-1 ${inputClassName}`}>
              <option value="">— не выбран —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-foreground/50">
              Токен счёта (Настройки → Банки) должен иметь права на эквайринг: MakeAcquiringOperation, ReadAcquiringData, ReadCustomerData.
              {initial.merchantId ? ` Торговая точка: ${initial.merchantId}.` : " Торговая точка ещё не проверена."}
            </p>
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!!busy}
            className="rounded-md bg-foreground px-6 py-2 font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy === "save" ? "Сохраняем..." : "Сохранить"}
          </button>
          <button type="button" disabled={!!busy} onClick={() => void run("atol", testAtol)} className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium disabled:opacity-50">
            {busy === "atol" ? "Проверяем..." : "Проверить АТОЛ"}
          </button>
          <button type="button" disabled={!!busy} onClick={() => void run("sbp", testSbp)} className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium disabled:opacity-50">
            {busy === "sbp" ? "Проверяем..." : "Проверить СБП"}
          </button>
        </div>
        {result && (result.ok ? <p className="text-sm text-green-600">{result.message}</p> : <p className="text-sm text-red-600">{result.error}</p>)}
      </form>

      <h2 className="mt-10 text-base font-semibold">Платежи СБП</h2>
      {payments.length ? (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-foreground/50">
                <th className="py-1 pr-4 font-normal">Создан</th>
                <th className="py-1 pr-4 font-normal">Заказ</th>
                <th className="py-1 pr-4 text-right font-normal">Сумма</th>
                <th className="py-1 pr-4 font-normal">Статус</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-t border-foreground/10">
                  <td className="whitespace-nowrap py-1.5 pr-4">{new Date(p.createdAt).toLocaleString("ru-RU")}</td>
                  <td className="py-1.5 pr-4">{p.orderNumber}</td>
                  <td className="whitespace-nowrap py-1.5 pr-4 text-right">{formatRub(p.amount)}</td>
                  <td className="py-1.5 pr-4">
                    {PAYMENT_STATUS[p.status] ?? p.status}
                    {p.paidAt && <span className="text-foreground/50"> · {new Date(p.paidAt).toLocaleString("ru-RU")}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-2 text-sm text-foreground/50">Платежей ещё не было.</p>
      )}

      <h2 className="mt-8 text-base font-semibold">Чеки</h2>
      {receipts.length ? (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-foreground/50">
                <th className="py-1 pr-4 font-normal">Создан</th>
                <th className="py-1 pr-4 font-normal">Заказ</th>
                <th className="py-1 pr-4 font-normal">Чек</th>
                <th className="py-1 pr-4 text-right font-normal">Сумма</th>
                <th className="py-1 pr-4 font-normal">Статус</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((r) => (
                <tr key={r.id} className="border-t border-foreground/10 align-top">
                  <td className="whitespace-nowrap py-1.5 pr-4">{new Date(r.createdAt).toLocaleString("ru-RU")}</td>
                  <td className="py-1.5 pr-4">{r.orderNumber}</td>
                  <td className="py-1.5 pr-4">{RECEIPT_KIND[r.kind] ?? r.kind}</td>
                  <td className="whitespace-nowrap py-1.5 pr-4 text-right">{formatRub(r.amount)}</td>
                  <td className="py-1.5 pr-4">
                    <span className={r.status === "fail" ? "text-red-600" : r.status === "done" ? "text-green-700 dark:text-green-500" : ""}>
                      {RECEIPT_STATUS[r.status] ?? r.status}
                    </span>
                    {r.error && <div className="text-xs text-foreground/60">{r.error}</div>}
                    {(r.status === "fail" || r.status === "new") && (
                      <button
                        type="button"
                        disabled={!!busy}
                        onClick={() => void run(`r-${r.id}`, () => retryReceipt(r.id))}
                        className="mt-1 text-xs underline underline-offset-2 disabled:opacity-50"
                      >
                        {busy === `r-${r.id}` ? "Отправляем..." : "Повторить"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-2 text-sm text-foreground/50">Чеков ещё не было.</p>
      )}
    </div>
  );
}
