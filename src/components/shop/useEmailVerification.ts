"use client";

import { useEffect, useState } from "react";
import {
  getEmailVerificationState,
  type EmailVerificationState,
} from "@/actions/shop/email-verification";
import { EMAIL_UNVERIFIED_COOKIE, EMAIL_VERIFIED_EVENT } from "@/lib/email-verification-shared";

function hasUnverifiedFlag() {
  return document.cookie.split("; ").some((c) => c === `${EMAIL_UNVERIFIED_COOKIE}=1`);
}

/**
 * Whether the signed-in customer still has to confirm their e-mail. Asks
 * the server only when the marker cookie is present, so guests and confirmed
 * users cost nothing. Re-checks whenever `recheckKey` changes; null while
 * the first check is in flight.
 */
export function useEmailVerification(recheckKey?: unknown) {
  const [state, setState] = useState<EmailVerificationState | null>(null);

  useEffect(() => {
    if (!hasUnverifiedFlag()) {
      setState({ required: false });
      return;
    }
    let cancelled = false;
    getEmailVerificationState().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [recheckKey]);

  useEffect(() => {
    const onVerified = () => setState({ required: false });
    window.addEventListener(EMAIL_VERIFIED_EVENT, onVerified);
    return () => window.removeEventListener(EMAIL_VERIFIED_EVENT, onVerified);
  }, []);

  return state;
}
