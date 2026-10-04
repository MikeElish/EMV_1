import { readFile, stat } from "fs/promises";
import path from "path";

// `next start` only serves the files that were in public/ when the server
// started, so anything uploaded afterwards (order and vehicle documents,
// fuel receipts, product photos …) would be a 404 until the next restart.
// Files known at startup are still served by Next itself; this route picks
// up the rest straight from disk.

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

const TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".zip": "application/zip",
};

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const file = path.resolve(UPLOADS_DIR, ...segments.map((s) => decodeURIComponent(s)));
  // Nothing outside public/uploads.
  if (!file.startsWith(UPLOADS_DIR + path.sep)) return new Response("Not found", { status: 404 });

  try {
    const info = await stat(file);
    if (!info.isFile()) return new Response("Not found", { status: 404 });
    const body = await readFile(file);
    const type = TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream";
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": type,
        "Content-Length": String(info.size),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, max-age=3600",
        // Uploaded SVG/HTML must not run scripts on our origin.
        ...(type === "image/svg+xml" || type === "application/octet-stream"
          ? { "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox" }
          : {}),
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
