// Renders the site icon (src/app/icon.svg) into build/icon.png for the
// installer, the window and the tray. Uses sharp from the site's node_modules.
const path = require("node:path");
const fs = require("node:fs");
const sharp = require("sharp");

const src = path.join(__dirname, "..", "..", "src", "app", "icon.svg");
const out = path.join(__dirname, "..", "build", "icon.png");

fs.mkdirSync(path.dirname(out), { recursive: true });
sharp(src, { density: 600 })
  .resize(512, 512)
  .png()
  .toFile(out)
  .then(() => console.log("icon:", out));
