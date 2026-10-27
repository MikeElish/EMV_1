// node scripts/run-selftest.js -- runs scripts/selftest.js inside Electron.
const { spawnSync } = require("node:child_process");
const electron = require("electron");

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE; // set in VS Code terminals
const r = spawnSync(electron, [`${__dirname}/selftest.js`], { env, stdio: "inherit" });
process.exit(r.status ?? 1);
