import "server-only";
import { cookies, headers } from "next/headers";
import type { Role } from "@prisma/client";
import { PD_CONSENT_COOKIE } from "@/lib/personal-data-consent-shared";

/** Everyone except the owner (the operator of the data) has to give consent. */
export function needsPersonalDataConsent(user: { role: Role; personalDataConsentAt: Date | null }) {
  return user.role !== "OWNER" && !user.personalDataConsentAt;
}

/**
 * Non-httpOnly marker cookie while the signed-in user still owes the consent,
 * so the browser asks the server about it on navigation only then. Writing a
 * cookie from a server action refreshes the page, so it's left alone when it
 * already says the right thing.
 */
export async function setConsentPendingFlag(pending: boolean) {
  const cookieStore = await cookies();
  const current = cookieStore.get(PD_CONSENT_COOKIE)?.value === "1";
  if (current === pending) return;
  if (!pending) {
    cookieStore.delete(PD_CONSENT_COOKIE);
    return;
  }
  const headersList = await headers();
  cookieStore.set(PD_CONSENT_COOKIE, "1", {
    httpOnly: false,
    secure: headersList.get("x-forwarded-proto") === "https",
    sameSite: "lax",
    path: "/",
    maxAge: 90 * 24 * 60 * 60,
  });
}
