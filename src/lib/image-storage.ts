import "server-only";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";

// Served directly by Next.js as a static file under /public -- the server's
// disk is persistent (unlike a serverless deployment), so this survives
// restarts and deploys as long as `public/uploads` itself isn't wiped.
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "products");

export async function uploadWatermarkedImage(buffer: Buffer, filename: string): Promise<string> {
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, filename), buffer);
  return `/uploads/products/${filename}`;
}

export async function deleteImage(url: string): Promise<void> {
  try {
    await unlink(path.join(UPLOAD_DIR, path.basename(url)));
  } catch {
    // Best-effort cleanup -- an already-missing file shouldn't block the admin action.
  }
}
