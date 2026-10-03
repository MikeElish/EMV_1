import "server-only";
import { prisma } from "@/lib/prisma";

export const SIGNATURE_LOGO_CID = "signature-logo@emv.one";
export const MAX_SIGNATURE_LOGO_BYTES = 300 * 1024;

/** Recognises the image by its first bytes -- the browser-reported type isn't trusted. */
export function sniffImageType(bytes: Buffer): string | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 6 && /^GIF8[79]a$/.test(bytes.subarray(0, 6).toString("ascii"))) return "image/gif";
  return null;
}

export async function getSignatureLogo(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mailSignatureLogo: true, mailSignatureLogoType: true },
  });
  if (!user?.mailSignatureLogo || !user.mailSignatureLogoType) return null;
  return { content: Buffer.from(user.mailSignatureLogo), contentType: user.mailSignatureLogoType };
}

export async function getSignatureLogoDataUri(userId: string) {
  const logo = await getSignatureLogo(userId);
  return logo ? `data:${logo.contentType};base64,${logo.content.toString("base64")}` : null;
}
