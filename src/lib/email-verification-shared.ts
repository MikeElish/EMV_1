// Shared by the server and the browser -- no server-only imports here.

export const EMAIL_CODE_LENGTH = 6;

// Non-httpOnly marker cookie, set while the signed-in customer's e-mail is
// unconfirmed. It carries no secrets: it only lets the browser skip the
// status request on every navigation for everyone else. The server re-checks
// the real state whenever it's present.
export const EMAIL_UNVERIFIED_COOKIE = "emv_email_unverified";

// Fired on window after a successful confirmation, so every open prompt
// (dialog, cart panel, settings) hides at once.
export const EMAIL_VERIFIED_EVENT = "emv:email-verified";
