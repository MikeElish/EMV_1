"use client";

import { useState } from "react";
import { EmailCodeInput } from "@/components/shop/EmailCodeInput";
import { resendEmailCode, verifyEmailCode } from "@/actions/shop/email-verification";
import { EMAIL_VERIFIED_EVENT } from "@/lib/email-verification-shared";

/**
 * The "Требуется подтверждение электронной почты" prompt with the code
 * boxes -- shared by the site-wide dialog, the cart, checkout and settings.
 */
export function EmailVerificationPanel({
  email,
  sendError,
  showHeading = true,
  autoFocus = false,
  onVerified,
}: {
  email: string;
  sendError?: string;
  showHeading?: boolean;
  autoFocus?: boolean;
  onVerified?: () => void;
}) {
  const [checking, setChecking] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [error, setError] = useState<string | null>(sendError ?? null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  // Remounts the boxes (clearing them) after a new code is sent.
  const [inputKey, setInputKey] = useState(0);

  async function handleComplete(code: string) {
    setChecking(true);
    setNotice(null);
    const result = await verifyEmailCode(code);
    setChecking(false);
    if (!result.ok) {
      setInvalid(true);
      setError(result.error);
      return;
    }
    setInvalid(false);
    setError(null);
    window.dispatchEvent(new Event(EMAIL_VERIFIED_EVENT));
    onVerified?.();
  }

  async function handleResend() {
    setResending(true);
    setNotice(null);
    const result = await resendEmailCode();
    setResending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setInvalid(false);
    setInputKey((k) => k + 1);
    setNotice(`Новый код отправлен на ${email}`);
  }

  return (
    <div>
      {showHeading && (
        <>
          <h2 className="text-lg font-bold">Требуется подтверждение электронной почты.</h2>
          <p className="mt-1 text-sm text-foreground/70">
            На указанный электронный адрес направлен временный код
          </p>
          <p className="mt-1 text-sm font-medium">{email}</p>
        </>
      )}

      <div className={showHeading ? "mt-4" : ""}>
        <EmailCodeInput
          key={inputKey}
          invalid={invalid}
          disabled={checking}
          autoFocus={autoFocus}
          onComplete={handleComplete}
          onEdit={() => {
            if (invalid) setInvalid(false);
          }}
        />
      </div>

      {checking && <p className="mt-2 text-sm text-foreground/50">Проверяем...</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {notice && <p className="mt-2 text-sm text-green-600">{notice}</p>}

      <button
        type="button"
        onClick={handleResend}
        disabled={resending}
        className="mt-3 text-sm text-foreground/60 underline underline-offset-4 hover:text-foreground disabled:opacity-50"
      >
        {resending ? "Отправляем..." : "Отправить код повторно"}
      </button>
    </div>
  );
}
