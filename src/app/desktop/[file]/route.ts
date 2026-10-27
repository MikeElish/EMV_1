import { readFile, stat } from "fs/promises";
import path from "path";
import { getMyAccess } from "@/lib/access-server";

// The Windows program (desktop/) and its auto-updates: `npm run dist` there
// makes EMV-Setup-<version>.exe, its .blockmap and latest.yml; they are
// copied by hand into desktop-releases/ at the site root (outside public/,
// which `next start` reads only at startup -- see app/uploads).
// Staff only: a signed-in employee downloads the installer in the browser;
// the program's updater sends the window's session cookie.

const RELEASES_DIR = path.join(process.cwd(), "desktop-releases");

const TYPES: Record<string, string> = {
  ".yml": "text/yaml; charset=utf-8",
  ".exe": "application/vnd.microsoft.portable-executable",
  ".blockmap": "application/octet-stream",
};

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  if (!(await getMyAccess())) return new Response("Not found", { status: 404 });
  const name = decodeURIComponent((await params).file);
  const type = TYPES[path.extname(name).toLowerCase()];
  if (!type || name !== path.basename(name)) return new Response("Not found", { status: 404 });

  const file = path.join(RELEASES_DIR, name);
  try {
    const info = await stat(file);
    if (!info.isFile()) return new Response("Not found", { status: 404 });
    return new Response(new Uint8Array(await readFile(file)), {
      headers: {
        "Content-Type": type,
        "Content-Length": String(info.size),
        "X-Content-Type-Options": "nosniff",
        // latest.yml must be fresh; installers are versioned by name.
        "Cache-Control": name.endsWith(".yml") ? "no-cache" : "public, max-age=86400",
        ...(type.startsWith("application/vnd") ? { "Content-Disposition": `attachment; filename="${name}"` } : {}),
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
