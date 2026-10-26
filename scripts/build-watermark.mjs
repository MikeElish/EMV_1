// Builds assets/watermark-tile.png: the EMV logo alternating with «www.emv.one»,
// tilted, white with a faint dark edge so it shows on light and dark photos.
// Run on a machine with fonts (the text is baked into the PNG, so the server
// needs none):  node scripts/build-watermark.mjs
import sharp from "sharp";

const CELL = 320; // one mark per cell; the tile is 2×2 cells, chequered
const ANGLE = -25;
const LOGO = 120;

// The logo is black on white: its darkness becomes the mark's opacity.
async function logoMask() {
  const { data, info } = await sharp("assets/emv-logo.png")
    .flatten({ background: "#ffffff" })
    .trim({ threshold: 20 })
    .resize(LOGO, LOGO, { fit: "contain", background: "#ffffff" })
    .greyscale()
    .negate()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

// White shape with the given alpha mask, plus a dark copy one pixel lower right.
async function markFromMask(mask, opacity) {
  const px = mask.width * mask.height;
  const white = Buffer.alloc(px * 4);
  const dark = Buffer.alloc(px * 4);
  for (let i = 0; i < px; i++) {
    const a = mask.data[i];
    white.set([255, 255, 255, Math.round(a * opacity)], i * 4);
    dark.set([0, 0, 0, Math.round(a * opacity * 0.5)], i * 4);
  }
  const raw = { raw: { width: mask.width, height: mask.height, channels: 4 } };
  return sharp({ create: { width: mask.width + 2, height: mask.height + 2, channels: 4, background: "#0000" } })
    .composite([
      { input: dark, ...raw, left: 2, top: 2 },
      { input: white, ...raw, left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
}

async function textMask() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="60">
    <rect width="260" height="60" fill="#000"/>
    <text x="130" y="42" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="34" fill="#fff">www.emv.one</text>
  </svg>`;
  const { data, info } = await sharp(Buffer.from(svg)).greyscale().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

async function cell(markPng) {
  const rotated = await sharp(markPng).rotate(ANGLE, { background: "#0000" }).png().toBuffer();
  const m = await sharp(rotated).metadata();
  return sharp({ create: { width: CELL, height: CELL, channels: 4, background: "#0000" } })
    .composite([{ input: rotated, left: Math.round((CELL - m.width) / 2), top: Math.round((CELL - m.height) / 2) }])
    .png()
    .toBuffer();
}

const logoCell = await cell(await markFromMask(await logoMask(), 0.4));
const textCell = await cell(await markFromMask(await textMask(), 0.4));

await sharp({ create: { width: CELL * 2, height: CELL * 2, channels: 4, background: "#0000" } })
  .composite([
    { input: logoCell, left: 0, top: 0 },
    { input: textCell, left: CELL, top: 0 },
    { input: textCell, left: 0, top: CELL },
    { input: logoCell, left: CELL, top: CELL },
  ])
  .png()
  .toFile("assets/watermark-tile.png");

console.log("assets/watermark-tile.png");
