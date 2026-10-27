// Self-test without the site: the price-list folder queue and the settings
// window. Run: node scripts/run-selftest.js (uses a temporary profile).
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { app, BrowserWindow, ipcMain } = require("electron");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "emv-selftest-"));
app.setPath("userData", path.join(tmp, "profile"));

const settings = require("../src/settings");
const prices = require("../src/prices");

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, what) => {
  console.log(`${ok ? "OK  " : "FAIL"} ${what}`);
  if (!ok) process.exitCode = 1;
};

app.whenReady().then(async () => {
  const dir = path.join(tmp, "Прайсы");
  settings.set({ pricesDir: dir });
  const announced = [];
  prices.start({ onNewFiles: (files) => announced.push(...files) });
  await wait(800);

  await prices.ensureSupplierFolders(['ООО "Ромашка"', "Автодеталь"]);
  check(fs.existsSync(path.join(dir, "ООО _Ромашка_")), "supplier subfolders created (quotes replaced)");

  fs.writeFileSync(path.join(dir, "Автодеталь", "прайс.xlsx"), "fake-xlsx");
  fs.writeFileSync(path.join(dir, "~$прайс.xlsx"), "excel lock file");
  fs.writeFileSync(path.join(dir, "notes.txt"), "not a price");
  await wait(6000);
  check(announced.length === 1 && announced[0].supplier === "Автодеталь", `one file announced with its supplier (${JSON.stringify(announced.map((a) => a.name))})`);
  check(prices.pending() === 1, "one file waiting");

  const f = await prices.next();
  check(f && f.name === "прайс.xlsx" && Buffer.from(f.data).toString() === "fake-xlsx", "next() returns the file data");
  check((await prices.next()) === null, "a taken file is not given twice");
  await prices.finish(f.id, true);
  const done = fs.readdirSync(path.join(dir, "Загружено"));
  check(done.length === 1 && done[0].includes("Автодеталь - прайс.xlsx"), `imported file moved: ${done[0]}`);

  fs.writeFileSync(path.join(dir, "общий.csv"), "a;b");
  await wait(6000);
  const g = await prices.next();
  check(g && g.supplier === null, "file in the root folder has no supplier");
  await prices.finish(g.id, false);
  await wait(4000);
  check(prices.pending() === 0 && fs.existsSync(path.join(dir, "общий.csv")), "skipped file stays and is not offered again");
  prices.retrySkipped();
  await wait(1500);
  check(prices.pending() === 1, "«Загрузить прайсы из папки» offers it again");

  // Settings window screenshot.
  ipcMain.handle("settings:load", () => ({
    settings: settings.get(),
    printers: [{ name: "HP LaserJet", displayName: "HP LaserJet", isDefault: true }, { name: "Zebra", displayName: "Zebra", isDefault: false }],
  }));
  const win = new BrowserWindow({
    width: 560, height: 620, show: false,
    webPreferences: { preload: path.join(__dirname, "..", "src", "settings-preload.js"), sandbox: true, contextIsolation: true },
  });
  await win.loadFile(path.join(__dirname, "..", "src", "settings.html"));
  await wait(500);
  const shot = path.join(tmp, "settings.png");
  fs.writeFileSync(shot, (await win.webContents.capturePage()).toPNG());
  console.log("settings screenshot:", shot);
  app.exit(process.exitCode || 0);
});
