// Shared by the server and the browser -- no server-only imports here.

// Set while the signed-in user hasn't given «Согласие на обработку
// персональных данных» yet; carries no secrets (see setConsentPendingFlag).
export const PD_CONSENT_COOKIE = "emv_pd_consent_pending";
