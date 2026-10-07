import "server-only";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";

const BASE_DIR = path.join(process.cwd(), "public", "uploads", "repairs");

export async function uploadRepairDocumentFile(
  repairId: string,
  buffer: Buffer,
  originalName: string
): Promise<string> {
  const dir = path.join(BASE_DIR, repairId);
  await mkdir(dir, { recursive: true });
  const ext = path.extname(originalName);
  const storedName = `${Date.now()}-${crypto.randomUUID()}${ext}`;
  await writeFile(path.join(dir, storedName), buffer);
  return `/uploads/repairs/${repairId}/${storedName}`;
}

export async function deleteRepairDocumentFile(url: string): Promise<void> {
  try {
    await unlink(path.join(process.cwd(), "public", url));
  } catch {
    // Best-effort cleanup -- an already-missing file shouldn't block the admin action.
  }
}
