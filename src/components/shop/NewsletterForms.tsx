"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import {
  getMyNewsletter,
  setMyNewsletter,
  subscribeFromForm,
  unsubscribeByToken,
  type NewsletterResult,
} from "@/actions/shop/newsletter";

/** The consent the law asks for (38-ФЗ ст. 18), worded once for every form. */
export const NEWSLETTER_CONSENT =
  "Согласен получать от EMV Запчасти новости о поступлениях и рекламные предложения на e-mail. Отписаться можно в любой момент по ссылке в письме.";

function Note({ result }: { result: NewsletterResult | null }) {
  if (!result) return null;
  return <p className={`mt-2 text-sm ${result.ok ? "text-green-600" : "text-red-600"}`}>{result.ok ? result.message : result.error}</p>;
}

/** Footer: e-mail + consent; the address is confirmed by the link in a letter. */
export function NewsletterSubscribe() {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [result, setResult] = useState<NewsletterResult | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const r = await subscribeFromForm(email, consent);
      setResult(r);
      if (r.ok) setEmail("");
    });
  }

  return (
    <form onSubmit={submit} className="max-w-md">
      <p className="font-medium text-foreground">Новости о поступлениях</p>
      <div className="mt-2 flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Ваш e-mail"
          aria-label="E-mail для подписки"
          className="min-w-0 flex-1 rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/50"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "..." : "Подписаться"}
        </button>
      </div>
      <label className="mt-2 flex items-start gap-2 text-xs">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
        <span>{NEWSLETTER_CONSENT}</span>
      </label>
      <Note result={result} />
    </form>
  );
}

/** Настройки покупателя: subscribed or not, saved on click. */
export function NewsletterToggle() {
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [result, setResult] = useState<NewsletterResult | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    getMyNewsletter().then((r) => {
      if (!cancelled && r) setSubscribed(r.subscribed);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (subscribed === null) return null;
  return (
    <div className="rounded-md border border-foreground/10 p-3">
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={subscribed}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.checked;
            startTransition(async () => {
              const r = await setMyNewsletter(next, "account");
              setResult(r);
              if (r.ok) setSubscribed(next);
            });
          }}
          className="mt-0.5"
        />
        <span>{NEWSLETTER_CONSENT}</span>
      </label>
      <Note result={result} />
    </div>
  );
}

export function UnsubscribeButton({ token }: { token: string }) {
  const [result, setResult] = useState<NewsletterResult | null>(null);
  const [pending, startTransition] = useTransition();
  if (result?.ok) return <p className="mt-6 text-green-600">{result.message}</p>;
  return (
    <div className="mt-6">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => setResult(await unsubscribeByToken(token)))}
        className="rounded-md bg-foreground px-6 py-2.5 font-medium text-background hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Отписываем..." : "Отписаться"}
      </button>
      <Note result={result} />
    </div>
  );
}
