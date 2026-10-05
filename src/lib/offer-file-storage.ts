import "server-only";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";

const BASE_DIR = path.join(process.cwd(), "public", "uploads", "offers");

/** Stores a supplier quote / price list attached to an offer; returns its public URL. */
export async function uploadOfferFile(productId: string, buffer: Buffer, originalName: string): Promise<string> {
  const dir = path.join(BASE_DIR, productId);
  await mkdir(dir, { recursive: true });
  const storedName = `${Date.now()}-${crypto.randomUUID()}${path.extname(originalName).toLowerCase()}`;
  await writeFile(path.join(dir, storedName), buffer);
  return `/uploads/offers/${productId}/${storedName}`;
}

export async function deleteOfferFile(url: string | null | undefined): Promise<void> {
  if (!url) return;
  try {
    await unlink(path.join(process.cwd(), "public", url));
  } catch {
    // Best-effort cleanup.
  }
}
