import "server-only";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";

const BASE_DIR = path.join(process.cwd(), "public", "uploads", "fuel");

/** Stores a fuel receipt scan under a random name; returns its public URL. */
export async function uploadFuelReceiptFile(buffer: Buffer, originalName: string): Promise<string> {
  const month = new Date().toISOString().slice(0, 7);
  const dir = path.join(BASE_DIR, month);
  await mkdir(dir, { recursive: true });
  const storedName = `${Date.now()}-${crypto.randomUUID()}${path.extname(originalName).toLowerCase()}`;
  await writeFile(path.join(dir, storedName), buffer);
  return `/uploads/fuel/${month}/${storedName}`;
}

export async function deleteFuelReceiptFile(url: string): Promise<void> {
  try {
    await unlink(path.join(process.cwd(), "public", url));
  } catch {
    // Best-effort cleanup -- an already-missing file shouldn't block the action.
  }
}
