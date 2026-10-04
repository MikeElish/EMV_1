"use client";

import { useEffect, useState } from "react";
import { USER_AGREEMENT_URL } from "@/lib/legal-docs";

// Accepted once -> never shown again in this browser. Closed with ✕ -> hidden
// until the next visit (session), as on most Russian sites.
const ACCEPTED_KEY = "emv-cookie-consent";
const CLOSED_KEY = "emv-cookie-notice-closed";

function read(storage: () => Storage, key: string) {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

function write(storage: () => Storage, key: string, value: string) {
  try {
    storage().setItem(key, value);
  } catch {
    // storage unavailable (private mode) -- the notice just shows again next time
  }
}

/** Cookie notice in the bottom-right corner of the taxi and shop pages. */
export function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (read(() => localStorage, ACCEPTED_KEY) || read(() => sessionStorage, CLOSED_KEY)) return;
    // A moment after load, so it doesn't cover the page while it renders.
    const timer = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  function accept() {
    write(() => localStorage, ACCEPTED_KEY, new Date().toISOString());
    setVisible(false);
  }

  function close() {
    write(() => sessionStorage, CLOSED_KEY, "1");
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Уведомление об использовании cookie"
      className="fixed bottom-4 right-4 z-[60] w-[calc(100vw-2rem)] max-w-sm rounded-xl border border-foreground/15 bg-background p-5 text-foreground shadow-2xl"
    >
      <button
        type="button"
        onClick={close}
        aria-label="Закрыть"
        className="absolute right-3 top-2 text-lg text-foreground/40 hover:text-foreground"
      >
        ✕
      </button>
      <p className="pr-4 text-sm font-semibold">Мы используем cookie</p>
      <p className="mt-2 text-sm leading-relaxed text-foreground/70">
        Сайт использует файлы cookie и сервис Яндекс Метрика, чтобы работать корректно и становиться
        удобнее. Продолжая пользоваться сайтом, вы соглашаетесь с использованием cookie и принимаете
        условия{" "}
        <a
          href={USER_AGREEMENT_URL}
          target="_blank"
          rel="noopener"
          className="text-foreground underline underline-offset-4 hover:opacity-80"
        >
          Пользовательского соглашения
        </a>
        .
      </p>
      <button
        type="button"
        onClick={accept}
        className="mt-4 w-full rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
      >
        Принять
      </button>
    </div>
  );
}
