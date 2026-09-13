import sharp from "sharp";

const TILE_SIZE = 220;
const MAX_WIDTH = 1600;

// Tiled (not single-corner) so the mark can't be cropped out: the EMV
// logo square + "emv.one", repeated at an angle across the whole photo.
function buildWatermarkTileSvg(): Buffer {
  return Buffer.from(`
<svg width="${TILE_SIZE}" height="${TILE_SIZE}" xmlns="http://www.w3.org/2000/svg">
  <g opacity="0.3" transform="rotate(-25 ${TILE_SIZE / 2} ${TILE_SIZE / 2})">
    <rect x="78" y="18" width="30" height="30" fill="none" stroke="#ffffff" stroke-width="3"/>
    <text x="83" y="40" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="10" letter-spacing="0.5" fill="#ffffff">EMV</text>
    <text x="25" y="75" font-family="Arial, Helvetica, sans-serif" font-weight="600" font-size="14" fill="#ffffff">emv.one</text>
  </g>
</svg>`);
}

/**
 * Resizes, flattens onto white, and tiles a semi-transparent EMV/emv.one
 * mark across the whole photo. There is never an unwatermarked copy stored
 * anywhere -- this is the only version that ever reaches Blob storage.
 */
export async function applyWatermark(input: Buffer): Promise<Buffer> {
  const tile = await sharp(buildWatermarkTileSvg()).png().toBuffer();

  return sharp(input)
    .rotate() // apply EXIF orientation before anything else
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .composite([{ input: tile, tile: true, blend: "over" }])
    .jpeg({ quality: 85 })
    .toBuffer();
}
