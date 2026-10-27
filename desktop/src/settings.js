// Program settings (Файл → Настройки), kept in %APPDATA%\EMV\settings.json.
const path = require("node:path");
const fs = require("node:fs");
const { app } = require("electron");

const FILE = path.join(app.getPath("userData"), "settings.json");

const DEFAULTS = {
  /** Printer for «Печать» in the order documents; "" = the Windows default. */
  printer: "",
  /** Watched folder: price lists dropped here (or into a supplier's subfolder) open in Проценка. */
  pricesDir: path.join(app.getPath("documents"), "EMV Прайсы"),
  pricesEnabled: true,
  notifyOrders: true,
  notifyMail: true,
};

let current = null;
const listeners = new Set();

function get() {
  if (!current) {
    try {
      current = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(FILE, "utf8")) };
    } catch {
      current = { ...DEFAULTS };
    }
  }
  return current;
}

function set(patch) {
  const next = { ...get() };
  for (const key of Object.keys(DEFAULTS)) {
    if (key in patch && typeof patch[key] === typeof DEFAULTS[key]) next[key] = patch[key];
  }
  current = next;
  try {
    fs.writeFileSync(FILE, JSON.stringify(current, null, 2));
  } catch {
    // keeps working with the values in memory
  }
  for (const fn of listeners) fn(current);
  return current;
}

function onChange(fn) {
  listeners.add(fn);
}

module.exports = { get, set, onChange };
