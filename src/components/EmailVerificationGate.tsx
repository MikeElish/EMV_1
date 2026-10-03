"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Modal } from "@/components/Modal";
import { EmailVerificationPanel } from "@/components/shop/EmailVerificationPanel";
import { useEmailVerification } from "@/components/shop/useEmailVerification";

/**
 * Site-wide: while the signed-in customer's e-mail is unconfirmed, every
 * page they open shows the confirmation dialog. ✕ hides it until the next
 * page.
 */
export function EmailVerificationGate() {
  const pathname = usePathname();
  const state = useEmailVerification(pathname);
  const [dismissedOn, setDismissedOn] = useState<string | null>(null);

  if (!state?.required || dismissedOn === pathname) return null;

  return (
    <Modal onClose={() => setDismissedOn(pathname)} maxWidthClassName="max-w-sm">
      <EmailVerificationPanel
        email={state.email}
        sendError={state.sendError}
        autoFocus
        onVerified={() => setDismissedOn(pathname)}
      />
    </Modal>
  );
}
