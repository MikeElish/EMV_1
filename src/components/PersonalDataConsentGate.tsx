"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import {
  acceptPersonalDataConsent,
  declinePersonalDataConsent,
  getPersonalDataConsentState,
} from "@/actions/personal-data-consent";
import { PD_CONSENT_COOKIE } from "@/lib/personal-data-consent-shared";
import { PERSONAL_DATA_CONSENT_URL } from "@/lib/legal-docs";

function hasPendingFlag() {
  return document.cookie.split("; ").some((c) => c === `${PD_CONSENT_COOKIE}=1`);
}

/**
 * Site-wide: an account created by staff (or any account without a recorded
 * consent) gets this dialog on sign-in and can't use the site until it ticks
 * «Согласие на обработку персональных данных». Checked with the server once
 * per page load, and on navigation while the marker cookie says it's pending.
 */
export function PersonalDataConsentGate() {
  const pathname = usePathname();
  const router = useRouter();
  const [required, setRequired] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const checkedOnce = useRef(false);

  useEffect(() => {
    if (checkedOnce.current && !hasPendingFlag()) return;
    checkedOnce.current = true;
    let cancelled = false;
    getPersonalDataConsentState().then((state) => {
      if (!cancelled) setRequired(state.required);
    });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (!required) return null;

  function accept() {
    setError(null);
    startTransition(async () => {
      const result = await acceptPersonalDataConsent();
      if (!result.ok) setError(result.error);
      else setRequired(false);
    });
  }

  function decline() {
    startTransition(async () => {
      await declinePersonalDataConsent();
      setRequired(false);
      router.push("/");
      router.refresh();
    });
  }

  return (
    <Modal onClose={() => {}} dismissible={false} maxWidthClassName="max-w-md">
      <h2 className="text-lg font-bold">Согласие на обработку персональных данных</h2>
      <p className="mt-2 text-sm text-foreground/70">
        Для работы с личным кабинетом нам нужно ваше согласие на обработку персональных данных
        (152-ФЗ). Ознакомьтесь с документом и отметьте согласие.
      </p>
      <label className="mt-4 flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          Согласие на{" "}
          <a
            href={PERSONAL_DATA_CONSENT_URL}
            target="_blank"
            rel="noopener"
            className="underline underline-offset-4 hover:opacity-80"
          >
            обработку персональных данных
          </a>
        </span>
      </label>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={accept}
          disabled={!agreed || pending}
          className="rounded-md bg-foreground px-5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Подтвердить
        </button>
        <button
          type="button"
          onClick={decline}
          disabled={pending}
          className="rounded-md border border-foreground/20 px-5 py-2 text-sm font-medium hover:bg-foreground/5 disabled:opacity-40"
        >
          Выйти из аккаунта
        </button>
      </div>
    </Modal>
  );
}
