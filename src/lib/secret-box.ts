import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

// Derived from SESSION_SECRET so no extra env var is needed. Rotating
// SESSION_SECRET makes every stored mailbox password unreadable -- they
// would have to be re-entered.
function getKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return createHash("sha256").update(`mail-credentials:${secret}`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((b) => b.toString("base64")).join(".");
}

export function decryptSecret(payload: string): string {
  const [iv, tag, encrypted] = payload.split(".").map((part) => Buffer.from(part, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
