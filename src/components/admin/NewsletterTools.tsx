"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addInvitees, removeInvitee, sendInvites, type InviteResult } from "@/actions/admin/newsletter";
import { formatShopPrice } from "@/lib/money";
import { TableSearchInput } from "@/components/admin/TableSearchInput";
import { CrmTableScroll, STICKY_THEAD } from "@/components/admin/CrmTableFrame";
import { Modal } from "@/components/Modal";

const TABS = [
  { key: "subscribers", label: "Подписчики" },
  { key: "invites", label: "Приглашения" },
  { key: "arrivals", label: "Поступления" },
] as const;

export function NewsletterTabs({ tab }: { tab: string }) {
  return (
    <div className="mb-4 flex shrink-0 gap-2">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={`/admin/crm/newsletter${t.key === "subscribers" ? "" : `?tab=${t.key}`}`}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            tab === t.key ? "bg-foreground text-background" : "text-foreground/60 hover:bg-foreground/5"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

function Note({ result }: { result: InviteResult | null }) {
  if (!result) return null;
  return <p className={`text-sm ${result.ok ? "text-green-600" : "text-red-600"}`}>{result.ok ? result.message : result.error}</p>;
}

// ---- Приглашения ----------------------------------------------------------

export type Invitee = {
  email: string;
  name: string | null;
  from: string;
  sentAt: string | null;
  status: "active" | "pending" | "unsubscribed" | null;
};

/** Not invited yet and hasn't decided about the newsletter. */
const canInvite = (r: Invitee) => !r.sentAt && !r.status;

const STATE = {
  active: { label: "Подписан", className: "text-green-600" },
  pending: { label: "Ждёт подтверждения", className: "text-amber-600" },
  unsubscribed: { label: "Отказался", className: "text-foreground/40" },
} as const;

function AddInvitees({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [result, setResult] = useState<InviteResult | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-lg">
      <h2 className="text-lg font-semibold">Добавить адреса</h2>
      <p className="mt-1 text-sm text-foreground/60">
        По одному в строке: адрес, через пробел — как обращаться (имя или компания). Например:
        <br />
        <code className="text-xs">ivanov@metall.ru Иван Петрович</code>
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        className="mt-3 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-foreground/50"
      />
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          disabled={pending || !text.trim()}
          onClick={() =>
            startTransition(async () => {
              const r = await addInvitees(text);
              setResult(r);
              if (r.ok) {
                setText("");
                router.refresh();
              }
            })
          }
          className="rounded-md bg-foreground px-5 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Добавляем..." : "Добавить"}
        </button>
        <Note result={result} />
      </div>
    </Modal>
  );
}

/**
 * Рассылка → Приглашения: a personal letter «подпишитесь на новости» to
 * clients who haven't agreed yet; the link in it subscribes them at once.
 */
export function InvitesTable({ rows, leftToday, perDay }: { rows: Invitee[]; leftToday: number; perDay: number }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [result, setResult] = useState<InviteResult | null>(null);
  const [pending, startTransition] = useTransition();

  const shown = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows
      .filter((r) => !query || `${r.email} ${r.name ?? ""}`.toLowerCase().includes(query))
      .sort((a, b) => Number(!canInvite(a)) - Number(!canInvite(b)) || a.email.localeCompare(b.email));
  }, [rows, search]);
  const open = shown.filter(canInvite);

  function send(list: Invitee[]) {
    setResult(null);
    startTransition(async () => {
      const r = await sendInvites(list.map((i) => ({ email: i.email, name: i.name })));
      setResult(r);
      setPicked(new Set());
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Приглашения</h1>
          <p className="text-xs text-foreground/50">
            Личное письмо «подпишитесь на новости» с ящика сайта — не реклама, поэтому согласие для него не нужно. Каждому
            один раз, не больше {perDay} в день. Сегодня можно ещё: {leftToday}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <TableSearchInput value={search} onChange={setSearch} placeholder="E-mail, имя..." />
          <button type="button" onClick={() => setAdding(true)} className="rounded-md border border-foreground/20 px-4 py-1.5 text-sm font-medium">
            Добавить адреса
          </button>
          <button
            type="button"
            disabled={pending || leftToday === 0 || (picked.size === 0 && open.length === 0)}
            onClick={() => send(picked.size ? open.filter((r) => picked.has(r.email)) : open.slice(0, leftToday))}
            className="rounded-md bg-foreground px-4 py-1.5 text-sm font-medium text-background disabled:opacity-50"
          >
            {pending ? "Отправляем..." : picked.size ? `Пригласить выбранных (${picked.size})` : `Пригласить ${Math.min(leftToday, open.length)}`}
          </button>
        </div>
      </div>
      <div className="mt-2 shrink-0">
        <Note result={result} />
      </div>

      {shown.length === 0 ? (
        <p className="mt-6 text-sm text-foreground/40">
          {rows.length ? "Ничего не найдено." : "Адресов пока нет — добавьте адреса клиентов (из переписки, визиток, договоров)."}
        </p>
      ) : (
        <CrmTableScroll className="mt-3">
          <table className="w-full text-sm">
            <thead className={STICKY_THEAD}>
              <tr className="text-left text-foreground/50">
                <th className="w-8 py-2" />
                <th className="py-2 pr-3">E-mail</th>
                <th className="py-2 pr-3">Обращение / компания</th>
                <th className="py-2 pr-3">Откуда</th>
                <th className="py-2 pr-3">Состояние</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.email} className="border-b border-foreground/10">
                  <td className="py-1.5">
                    {canInvite(r) && (
                      <input
                        type="checkbox"
                        aria-label={`Выбрать ${r.email}`}
                        checked={picked.has(r.email)}
                        onChange={(e) =>
                          setPicked((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(r.email);
                            else next.delete(r.email);
                            return next;
                          })
                        }
                      />
                    )}
                  </td>
                  <td className="py-1.5 pr-3">{r.email}</td>
                  <td className="py-1.5 pr-3 text-foreground/70">{r.name || "—"}</td>
                  <td className="py-1.5 pr-3 text-foreground/50">{r.from}</td>
                  <td className="whitespace-nowrap py-1.5 pr-3">
                    {r.status ? (
                      <span className={STATE[r.status].className}>{STATE[r.status].label}</span>
                    ) : r.sentAt ? (
                      <span className="text-foreground/60">
                        Приглашён {new Date(r.sentAt).toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" })}
                      </span>
                    ) : (
                      <span className="text-foreground/40">Не приглашён</span>
                    )}
                  </td>
                  <td className="py-1.5 text-right">
                    {r.from === "Добавлен вручную" && !r.sentAt && (
                      <button
                        type="button"
                        onClick={() => startTransition(async () => {
                          await removeInvitee(r.email);
                          router.refresh();
                        })}
                        className="text-xs text-foreground/50 hover:text-red-600"
                      >
                        Убрать
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CrmTableScroll>
      )}

      {adding && <AddInvitees onClose={() => setAdding(false)} />}
    </>
  );
}

// ---- Поступления ----------------------------------------------------------

type Arrival = {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  price: number;
  stock: number;
  url: string;
  newArrivalAt: string;
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The picked products as a ready block for a letter (HTML for the mailing service, or plain text). */
function letterBlock(items: Arrival[]) {
  const html = `<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">
<tr style="background:#f3f3f3"><th align="left">Запчасть</th><th align="left">Артикул</th><th align="right">Цена</th><th align="right">В наличии</th></tr>
${items
  .map(
    (p) =>
      `<tr style="border-top:1px solid #e5e5e5"><td><a href="${p.url}" style="color:#111">${esc(p.name)}${p.brand ? ` ${esc(p.brand)}` : ""}</a></td><td>${esc(p.sku)}</td><td align="right">${esc(formatShopPrice(p.price))}</td><td align="right">${p.stock} шт</td></tr>`
  )
  .join("\n")}
</table>`;
  const text = items
    .map((p) => `${p.name}${p.brand ? ` ${p.brand}` : ""}, арт. ${p.sku} — ${formatShopPrice(p.price)}, в наличии ${p.stock} шт: ${p.url}`)
    .join("\n");
  return { html, text };
}

/** Рассылка → Поступления: what came to the warehouse lately, ready to paste into a letter. */
export function ArrivalsList({ days, products }: { days: number; products: Arrival[] }) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(products.map((p) => p.id)));
  const [copied, setCopied] = useState<string | null>(null);
  const chosen = products.filter((p) => picked.has(p.id));

  async function copy(kind: "html" | "text") {
    const block = letterBlock(chosen);
    try {
      if (kind === "html" && "ClipboardItem" in window) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([block.html], { type: "text/html" }),
            "text/plain": new Blob([block.text], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(kind === "html" ? block.html : block.text);
      }
      setCopied(kind === "html" ? "Таблица скопирована — вставьте в редактор письма" : "Текст скопирован");
    } catch {
      setCopied("Не удалось скопировать — браузер не дал доступ к буферу обмена");
    }
  }

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Поступления</h1>
          <p className="text-xs text-foreground/50">
            Товары на сайте, у которых за последние {days} дней выросло наличие (по синхронизации с 1С). Отметьте нужные и
            скопируйте в письмо.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={!chosen.length}
            onClick={() => copy("html")}
            className="rounded-md bg-foreground px-4 py-1.5 text-sm font-medium text-background disabled:opacity-50"
          >
            Скопировать для письма ({chosen.length})
          </button>
          <button
            type="button"
            disabled={!chosen.length}
            onClick={() => copy("text")}
            className="rounded-md border border-foreground/20 px-4 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            Текстом
          </button>
        </div>
      </div>
      {copied && <p className="mt-2 shrink-0 text-sm text-green-600">{copied}</p>}

      {products.length === 0 ? (
        <p className="mt-6 text-sm text-foreground/40">За {days} дней поступлений не было.</p>
      ) : (
        <CrmTableScroll className="mt-3">
          <table className="w-full text-sm">
            <thead className={STICKY_THEAD}>
              <tr className="text-left text-foreground/50">
                <th className="w-8 py-2">
                  <input
                    type="checkbox"
                    aria-label="Выбрать все"
                    checked={picked.size === products.length}
                    onChange={(e) => setPicked(new Set(e.target.checked ? products.map((p) => p.id) : []))}
                  />
                </th>
                <th className="py-2 pr-3">Наименование</th>
                <th className="py-2 pr-3">Бренд</th>
                <th className="py-2 pr-3">Артикул</th>
                <th className="py-2 pr-3 text-right">Цена</th>
                <th className="py-2 pr-3 text-right">В наличии</th>
                <th className="py-2">Поступил</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-foreground/10">
                  <td className="py-1.5">
                    <input
                      type="checkbox"
                      aria-label={`Выбрать ${p.name}`}
                      checked={picked.has(p.id)}
                      onChange={(e) =>
                        setPicked((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(p.id);
                          else next.delete(p.id);
                          return next;
                        })
                      }
                    />
                  </td>
                  <td className="py-1.5 pr-3">
                    <a href={p.url} target="_blank" rel="noopener" className="hover:underline">
                      {p.name}
                    </a>
                  </td>
                  <td className="py-1.5 pr-3 text-foreground/70">{p.brand ?? "—"}</td>
                  <td className="py-1.5 pr-3 text-foreground/70">{p.sku}</td>
                  <td className="whitespace-nowrap py-1.5 pr-3 text-right">{formatShopPrice(p.price)}</td>
                  <td className="py-1.5 pr-3 text-right">{p.stock}</td>
                  <td className="whitespace-nowrap py-1.5 text-foreground/60">
                    {new Date(p.newArrivalAt).toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CrmTableScroll>
      )}
    </>
  );
}
