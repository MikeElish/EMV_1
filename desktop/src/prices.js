// The price-list folder: Excel/CSV files dropped into it -- into a supplier's
// subfolder (Прайсы\<Поставщик>\) or the folder itself -- are queued for
// CRM → Проценка, which opens them one by one in «Загрузка предложений».
// Loaded files move to Загружено\, skipped ones stay until they change.
const path = require("node:path");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const crypto = require("node:crypto");
const settings = require("./settings");

const IMPORTED_DIR = "Загружено";
const PRICE_FILE = /\.(xlsx|xls|ods|csv)$/i;
const MAX_SIZE = 20 * 1024 * 1024; // the site's limit
const RESCAN_MS = 30_000;

/** Same rule as the site uses to match a subfolder to a supplier name. */
const folderName = (name) => name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/[. ]+$/, "").trim();

/** id → { id, path, name, supplier, key } */
const queue = new Map();
const taken = new Set();
const skipped = new Set(); // file keys (path|mtime|size) the user closed without loading
const lastSeen = new Map(); // path → key at the previous scan (a file is queued once it stops changing)

let dir = null;
let watcher = null;
let interval = null;
let debounce = null;
let onNew = () => {};

async function listCandidates(root) {
  const out = [];
  const add = async (folder, supplier) => {
    let entries;
    try {
      entries = await fsp.readdir(folder, { withFileTypes: true });
    } catch {
      return [];
    }
    const subdirs = [];
    for (const e of entries) {
      if (e.name.startsWith("~$") || e.name.startsWith(".")) continue; // Excel lock files, hidden
      if (e.isFile() && PRICE_FILE.test(e.name)) out.push({ path: path.join(folder, e.name), name: e.name, supplier });
      else if (e.isDirectory() && supplier === null && e.name !== IMPORTED_DIR) subdirs.push(e.name);
    }
    return subdirs;
  };
  for (const sub of await add(root, null)) await add(path.join(root, sub), sub);
  return out;
}

async function scan() {
  if (!dir) return;
  const found = await listCandidates(dir);
  const present = new Set();
  const fresh = [];
  let changing = false;
  for (const f of found) {
    let st;
    try {
      st = await fsp.stat(f.path);
    } catch {
      continue;
    }
    present.add(f.path);
    if (st.size === 0 || st.size > MAX_SIZE) continue;
    const key = `${f.path}|${st.mtimeMs}|${st.size}`;
    if (lastSeen.get(f.path) !== key) {
      // New or still being written: look again shortly.
      lastSeen.set(f.path, key);
      changing = true;
      continue;
    }
    if (skipped.has(key) || [...queue.values()].some((q) => q.key === key)) continue;
    // A changed file replaces its older queued version.
    for (const [id, q] of queue) if (q.path === f.path && !taken.has(id)) queue.delete(id);
    const id = crypto.createHash("sha1").update(key).digest("hex").slice(0, 16);
    const item = { id, ...f, key };
    queue.set(id, item);
    fresh.push(item);
  }
  for (const [id, q] of queue) if (!present.has(q.path) && !taken.has(id)) queue.delete(id);
  for (const p of lastSeen.keys()) if (!present.has(p)) lastSeen.delete(p);
  if (changing) schedule(3000);
  if (fresh.length) onNew(fresh);
}

function schedule(ms = 1000) {
  clearTimeout(debounce);
  debounce = setTimeout(() => scan().catch(() => {}), ms);
}

function stop() {
  watcher?.close();
  watcher = null;
  clearInterval(interval);
  clearTimeout(debounce);
  dir = null;
  queue.clear();
  lastSeen.clear();
}

function restart() {
  stop();
  const s = settings.get();
  if (!s.pricesEnabled || !s.pricesDir) return;
  dir = s.pricesDir;
  try {
    fs.mkdirSync(dir, { recursive: true });
    watcher = fs.watch(dir, { recursive: true }, (_event, file) => {
      if (!file || !String(file).startsWith(IMPORTED_DIR)) schedule();
    });
    watcher.on("error", () => {}); // folder removed: the periodic scan keeps going
  } catch {
    // folder unavailable (network drive offline …): the periodic scan retries
  }
  interval = setInterval(() => scan().catch(() => {}), RESCAN_MS);
  schedule(500);
}

/** @param {{ onNewFiles: (files: {name: string, supplier: string|null}[]) => void }} opts */
function start(opts) {
  onNew = opts.onNewFiles;
  let watched = "";
  const key = (s) => `${s.pricesEnabled}|${s.pricesDir}`;
  settings.onChange((s) => {
    if (key(s) !== watched) {
      watched = key(s);
      restart();
    }
  });
  watched = key(settings.get());
  restart();
}

async function next() {
  for (const item of queue.values()) {
    if (taken.has(item.id)) continue;
    let data;
    try {
      data = await fsp.readFile(item.path);
    } catch {
      queue.delete(item.id);
      continue;
    }
    taken.add(item.id);
    return { id: item.id, name: item.name, supplier: item.supplier, data };
  }
  return null;
}

async function finish(id, imported) {
  const item = queue.get(id);
  taken.delete(id);
  if (!item) return;
  queue.delete(id);
  if (!imported) {
    skipped.add(item.key);
    return;
  }
  const doneDir = path.join(dir || path.dirname(item.path), IMPORTED_DIR);
  const d = new Date();
  const p2 = (n) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}-${p2(d.getMinutes())}-${p2(d.getSeconds())}`;
  const target = path.join(doneDir, `${stamp} ${item.supplier ? `${folderName(item.supplier)} - ` : ""}${item.name}`);
  try {
    await fsp.mkdir(doneDir, { recursive: true });
    await fsp.rename(item.path, target);
  } catch {
    skipped.add(item.key); // locked (open in Excel) -- at least don't offer it again
  }
}

/** Lets skipped files be offered again (tray → «Прайсы: показать пропущенные»). */
function retrySkipped() {
  skipped.clear();
  schedule(0);
}

/** Creates a subfolder for every supplier that has none yet (never removes any). */
async function ensureSupplierFolders(names) {
  if (!dir || !Array.isArray(names)) return;
  for (const n of names) {
    const sub = folderName(String(n));
    if (!sub || sub === IMPORTED_DIR) continue;
    await fsp.mkdir(path.join(dir, sub), { recursive: true }).catch(() => {});
  }
}

const pending = () => [...queue.keys()].filter((id) => !taken.has(id)).length;

module.exports = { start, next, finish, retrySkipped, ensureSupplierFolders, pending, folderName };
