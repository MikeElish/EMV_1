// Which attachments may be shown in the browser. Decided by the file's own
// bytes, not by the type the sender declared: HTML/SVG/XML from a letter must
// never render on our origin, so only these few safe kinds are previewed.

export type PreviewKind = "image" | "pdf" | "text" | "sheet";

const IMAGE_SIGNATURES: { type: string; test: (b: Buffer) => boolean }[] = [
  { type: "image/png", test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { type: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: "image/gif", test: (b) => /^GIF8[79]a$/.test(b.subarray(0, 6).toString("ascii")) },
  { type: "image/webp", test: (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP" },
];

const TEXT_EXTENSIONS = /\.(txt|csv|log|tsv)$/i;
const SHEET_EXTENSIONS = /\.(xlsx|xls|ods)$/i;

export function detectPreview(filename: string, contentType: string, content: Buffer): { kind: PreviewKind; mime: string } | null {
  for (const sig of IMAGE_SIGNATURES) if (content.length > 12 && sig.test(content)) return { kind: "image", mime: sig.type };
  if (content.subarray(0, 5).toString("ascii") === "%PDF-") return { kind: "pdf", mime: "application/pdf" };
  if (SHEET_EXTENSIONS.test(filename)) return { kind: "sheet", mime: "application/octet-stream" };
  if (TEXT_EXTENSIONS.test(filename) || /^text\/(plain|csv)/i.test(contentType)) {
    return { kind: "text", mime: "text/plain; charset=utf-8" };
  }
  return null;
}

/** UTF-8, or Windows-1251 when the bytes aren't valid UTF-8 (common in Russian CSV exports). */
export function decodeText(content: Buffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(content);
  } catch {
    return new TextDecoder("windows-1251").decode(content);
  }
}
