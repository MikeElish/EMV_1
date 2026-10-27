// Starts Electron for development. VS Code terminals export
// ELECTRON_RUN_AS_NODE=1, which would make Electron behave as plain Node,
// so it is dropped here. Usage: node scripts/run.js [url]
const { spawn } = require("node:child_process");
const electron = require("electron"); // path to electron.exe

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
if (process.argv[2]) env.EMV_URL = process.argv[2];

spawn(electron, ["."], { cwd: `${__dirname}/..`, env, stdio: "inherit" }).on("exit", (code) =>
  process.exit(code ?? 0),
);
