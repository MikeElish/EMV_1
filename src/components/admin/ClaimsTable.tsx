"use client";

import { useMemo, useState, useTransition } from "react";
import { formatRub } from "@/lib/money";
import { Modal } from "@/components/Modal";
import { TableSearchInput } from "@/components/admin/TableSearchInput";
import { CrmTableScroll, STICKY_THEAD } from "@/components/admin/CrmTableFrame";
import { claimToSupplier, updateClaim } from "@/actions/admin/claims";
import { CLAIM_RESOLUTIONS, CLAIM_STATUSES } from "@/lib/validators/claims";
import { useRememberedState } from "@/components/admin/AdminPlaces";

export type ClaimRow = {
  id: string;
  number: number;
  createdAt: string;
  orderNumber: string;
  customer: string;
  email: string | null;
  name: string;
  sku: string | null;
  quantity: number;
  price: number;
  reason: string;
  description: string;
  photos: string[];
  status: string;
  resolution: string | null;
  answer: string | null;
  supplierClaimAt: string | null;
};

const inputClass =
  "mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/50";
const STATUS_STYLES: Record<string, string> = {
  Новая: "bg-blue-600/10 text-blue-700 dark:text-blue-400",
  "На проверке": "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  Принята: "bg-green-600/10 text-green-700 dark:text-green-500",
  Отклонена: "bg-red-600/10 text-red-700 dark:text-red-400",
  Закрыта: "bg-foreground/10 text-foreground/50",
};
const OPEN = ["Новая", "На проверке", "Принята"];
const date = (iso: string) => new Date(iso).toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" });

function ClaimCard({ claim, onClose }: { claim: ClaimRow; onClose: () => void }) {
  const [status, setStatus] = useState(claim.status);
  const [resolution, setResolution] = useState(claim.resolution ?? "");
  const [answer, setAnswer] = useState(claim.answer ?? "");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setNote(null);
    startTransition(async () => {
      const r = await updateClaim(claim.id, { status, resolution, answer });
      setNote(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
    });
  }
  function toSupplier() {
    if (!confirm("Отправить претензию поставщику товара с фото?")) return;
    setNote(null);
    startTransition(async () => {
      const r = await claimToSupplier(claim.id);
      setNote(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
    });
  }

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-2xl">
      <h2 className="text-lg font-semibold">
        Рекламация № {claim.number} <span className="font-normal text-foreground/50">от {date(claim.createdAt)}</span>
      </h2>
      <p className="mt-1 text-sm text-foreground/70">
        Заказ {claim.orderNumber} · {claim.customer}
        {claim.email && ` · ${claim.email}`}
      </p>
      <div className="mt-4 rounded-md border border-foreground/10 p-3 text-sm">
        <p className="font-medium">
          {claim.name}
          {claim.sku && <span className="font-normal text-foreground/50"> · {claim.sku}</span>}
        </p>
        <p className="mt-1 text-foreground/70">
          {claim.quantity} шт. × {formatRub(claim.price)} = {formatRub(claim.price * claim.quantity)} · причина: <b>{claim.reason}</b>
        </p>
        <p className="mt-2 whitespace-pre-wrap">{claim.description}</p>
        {claim.photos.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {claim.photos.map((url) => (
              <a key={url} href={url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element -- customer photos of any size */}
                <img src={url} alt="Фото" className="h-24 w-24 rounded border border-foreground/10 object-cover" />
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-foreground/60">Статус</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
            {CLAIM_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm text-foreground/60">Решение</label>
          <select value={resolution} onChange={(e) => setResolution(e.target.value)} className={inputClass}>
            <option value="">—</option>
            {CLAIM_RESOLUTIONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-3">
        <label className="text-sm text-foreground/60">Ответ клиенту (уйдёт в письме о смене статуса)</label>
        <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={3} className={inputClass} />
      </div>
      {note && <p className={`mt-2 text-sm ${note.ok ? "text-green-600" : "text-red-600"}`}>{note.text}</p>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={toSupplier}
          disabled={pending}
          className="rounded-md border border-foreground/20 px-3 py-2 text-sm hover:bg-foreground/5 disabled:opacity-50"
        >
          {claim.supplierClaimAt ? `Претензия отправлена ${date(claim.supplierClaimAt)} — ещё раз` : "Претензия поставщику"}
        </button>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="rounded-md border border-foreground/20 px-4 py-2 text-sm">
            Закрыть
          </button>
          <button type="button" onClick={save} disabled={pending} className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50">
            {pending ? "..." : "Сохранить"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function ClaimsTable({ claims }: { claims: ClaimRow[] }) {
  const [search, setSearch] = useRememberedState("search", "");
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [open, setOpen] = useState<ClaimRow | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return claims.filter(
      (c) =>
        (!onlyOpen || OPEN.includes(c.status)) &&
        (!q || [c.number, c.orderNumber, c.customer, c.email, c.name, c.sku, c.reason].filter(Boolean).join(" ").toLowerCase().includes(q))
    );
  }, [claims, search, onlyOpen]);

  return (
    <>
      <div className="flex shrink-0 items-center gap-3">
        <h1 className="text-lg font-semibold">Рекламации</h1>
        <label className="ml-4 flex cursor-pointer items-center gap-2 text-sm text-foreground/70">
          <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
          Не завершённые
        </label>
        <div className="ml-auto">
          <TableSearchInput value={search} onChange={setSearch} placeholder="Поиск..." />
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="mt-6 text-sm text-foreground/40">
          {claims.length ? "Ничего не найдено." : "Заявок пока нет — клиенты оформляют их в «Мои заказы» у отгруженных позиций."}
        </p>
      ) : (
        <CrmTableScroll className="mt-4">
          <table className="w-full text-sm">
            <thead className={STICKY_THEAD}>
              <tr className="text-left text-foreground/50">
                <th className="py-2 pr-4">№</th>
                <th className="py-2 pr-4">Дата</th>
                <th className="py-2 pr-4">Заказ</th>
                <th className="py-2 pr-4">Клиент</th>
                <th className="py-2 pr-4">Товар</th>
                <th className="py-2 pr-4">Кол-во</th>
                <th className="py-2 pr-4">Причина</th>
                <th className="py-2 pr-4">Статус</th>
                <th className="py-2 pr-4">Решение</th>
                <th className="py-2 pr-4">Поставщику</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} onClick={() => setOpen(c)} className="cursor-pointer border-b border-foreground/10 hover:bg-foreground/5">
                  <td className="py-2 pr-4 font-medium">{c.number}</td>
                  <td className="whitespace-nowrap py-2 pr-4">{date(c.createdAt)}</td>
                  <td className="whitespace-nowrap py-2 pr-4">{c.orderNumber}</td>
                  <td className="py-2 pr-4">{c.customer}</td>
                  <td className="py-2 pr-4">
                    {c.name}
                    {c.sku && <div className="text-xs text-foreground/50">{c.sku}</div>}
                  </td>
                  <td className="py-2 pr-4">{c.quantity}</td>
                  <td className="py-2 pr-4">
                    {c.reason}
                    {c.photos.length > 0 && <span className="ml-1 text-xs text-foreground/50">· фото {c.photos.length}</span>}
                  </td>
                  <td className="py-2 pr-4">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[c.status] ?? ""}`}>{c.status}</span>
                  </td>
                  <td className="py-2 pr-4">{c.resolution ?? "—"}</td>
                  <td className="whitespace-nowrap py-2 pr-4">{c.supplierClaimAt ? date(c.supplierClaimAt) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CrmTableScroll>
      )}
      {open && <ClaimCard key={open.id} claim={open} onClose={() => setOpen(null)} />}
    </>
  );
}
