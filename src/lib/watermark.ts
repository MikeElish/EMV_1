import { readFile } from "fs/promises";
import path from "path";
import sharp from "sharp";

const MAX_WIDTH = 1600;
// assets/watermark-tile.png is 640 px wide (2×2 marks) and is sized for a
// 1600 px photo; smaller photos get a smaller tile, so about five marks fit across.
const TILE_WIDTH = 640;
const MIN_TILE_WIDTH = 360;

// Tiled (not single-corner) so the mark can't be cropped out: the EMV logo
// alternating with «www.emv.one», tilted, across the whole photo. The tile is
// a ready PNG (scripts/build-watermark.mjs) -- the server has no fonts to draw text.
let tilePng: Promise<Buffer> | null = null;
const loadTile = () => (tilePng ??= readFile(path.join(process.cwd(), "assets", "watermark-tile.png")));

/**
 * Resizes, flattens onto white, and tiles the semi-transparent EMV /
 * www.emv.one mark across the whole photo. There is never an unwatermarked
 * copy stored anywhere -- this is the only version that is ever saved.
 */
export async function applyWatermark(input: Buffer): Promise<Buffer> {
  const photo = await sharp(input)
    .rotate() // apply EXIF orientation before anything else
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .toBuffer({ resolveWithObject: true });

  // The tile is square and may not be bigger than the photo (small or long narrow shots).
  const tileWidth = Math.min(
    Math.max(MIN_TILE_WIDTH, Math.round((TILE_WIDTH * photo.info.width) / MAX_WIDTH)),
    photo.info.width,
    photo.info.height
  );
  const tile = await sharp(await loadTile()).resize({ width: tileWidth }).png().toBuffer();

  return sharp(photo.data)
    .composite([{ input: tile, tile: true, blend: "over" }])
    .jpeg({ quality: 85 })
    .toBuffer();
}
