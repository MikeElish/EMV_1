import "server-only";
import { readFile } from "fs/promises";
import path from "path";

/** Where the Windows program's installers live (served by app/desktop/[file]). */
export const DESKTOP_RELEASES_DIR = path.join(process.cwd(), "desktop-releases");

export type DesktopRelease = { version: string; file: string; releasedAt: Date | null };

/** The latest uploaded installer, from latest.yml; null when none is uploaded. */
export async function getDesktopRelease(): Promise<DesktopRelease | null> {
  let yml: string;
  try {
    yml = await readFile(path.join(DESKTOP_RELEASES_DIR, "latest.yml"), "utf8");
  } catch {
    return null;
  }
  const field = (name: string) => yml.match(new RegExp(`^${name}:\\s*'?([^'\\r\\n]+)'?`, "m"))?.[1].trim() ?? null;
  const version = field("version");
  const file = field("path");
  if (!version || !file || file !== path.basename(file)) return null;
  const date = field("releaseDate");
  return { version, file, releasedAt: date && !Number.isNaN(Date.parse(date)) ? new Date(date) : null };
}
