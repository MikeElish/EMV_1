// EMV desktop: an Electron window around emv.one with a tray icon,
// a remembered window position, an offline screen and auto-updates; plus
// notifications (poller.js), silent printing (printing.js) and the
// price-list folder (prices.js), set up in Файл → Настройки (settings.html).
const path = require("node:path");
const fs = require("node:fs");
const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  Notification,
  ipcMain,
  shell,
  session,
  nativeImage,
  dialog,
  clipboard,
} = require("electron");
const { autoUpdater } = require("electron-updater");
const settings = require("./settings");
const poller = require("./poller");
const printing = require("./printing");
const prices = require("./prices");

// EMV_URL lets `npm run dev` point the window at a local `next dev`.
const START_URL = (process.env.EMV_URL || "https://emv.one").replace(/\/+$/, "");
// Hosts that may open inside the window; everything else goes to the browser.
const INTERNAL_HOSTS = new Set([new URL(START_URL).hostname, "emv.one", "www.emv.one"]);
// The program is for staff: it opens the CRM (signed-out → the login page).
const HOME_URL = `${START_URL}/admin`;

const ICON_PATH = app.isPackaged
  ? path.join(process.resourcesPath, "icon.png")
  : path.join(__dirname, "..", "build", "icon.png");
const STATE_FILE = path.join(app.getPath("userData"), "window-state.json");

/** @type {BrowserWindow | null} */
let win = null;
/** @type {Tray | null} */
let tray = null;
let quitting = false;

// One copy of the program at a time: a second launch focuses the first.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", showWindow);
  app.whenReady().then(start);
}

app.setAppUserModelId("one.emv.desktop"); // Windows notifications need it

function isInternal(url) {
  try {
    const u = new URL(url);
    return (u.protocol === "https:" || u.protocol === "http:") && INTERNAL_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

function openExternal(url) {
  if (/^(https?|mailto|tel):/i.test(url)) shell.openExternal(url);
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return { width: 1400, height: 900, maximized: true };
  }
}

function saveState() {
  if (!win || win.isDestroyed()) return;
  const state = { ...win.getNormalBounds(), maximized: win.isMaximized() };
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state));
  } catch {
    // not critical: the window just opens at the default size next time
  }
}

function showWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function start() {
  // The site only needs notifications, clipboard and fullscreen (video).
  const allowed = new Set(["notifications", "clipboard-read", "clipboard-sanitized-write", "fullscreen"]);
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb, details) => {
    cb(allowed.has(permission) && isInternal(details.requestingUrl || wc.getURL()));
  });

  setupIpc();
  createMenu();
  createWindow();
  createTray();
  setupUpdates();

  poller.start({
    baseUrl: START_URL,
    notify: ({ title, body, path: page }) => notify(title, body, () => openPage(page)),
    onState: ({ signedIn, unread }) => {
      if (!tray) return;
      tray.setToolTip(!signedIn ? "EMV — войдите в CRM" : unread ? `EMV — непрочитанных писем: ${unread}` : "EMV");
    },
    onSuppliers: (names) => prices.ensureSupplierFolders(names),
  });

  prices.start({
    onNewFiles: (files) => {
      announcePrices();
      // On Проценка already: the page takes the file itself.
      if (win?.isFocused() && onPriceCheck()) return;
      const first = files[0];
      notify(
        files.length > 1 ? `Новые прайсы: ${files.length}` : "Новый прайс",
        `${first.name}${first.supplier ? ` · ${first.supplier}` : ""}\nНажмите, чтобы загрузить в Проценку`,
        openPriceCheck,
      );
    },
  });
}

// ---- notifications, pages -------------------------------------------------------

const PRICE_CHECK_PATH = "/admin/crm/price-check";

function notify(title, body, onClick) {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body, icon: ICON_PATH });
  n.on("click", onClick);
  n.show();
  if (win && !win.isFocused()) win.flashFrame(true);
}

/** Opens a page of the site in the main window (path from the site root). */
function openPage(page) {
  if (!win) return;
  showWindow();
  win.loadURL(START_URL + page);
}

function onPriceCheck() {
  try {
    return new URL(win.webContents.getURL()).pathname.startsWith(PRICE_CHECK_PATH);
  } catch {
    return false;
  }
}

/** Проценка with the waiting price lists (an open import window there is not reloaded). */
function openPriceCheck() {
  if (!win) return;
  if (!onPriceCheck()) return openPage(PRICE_CHECK_PATH);
  showWindow();
  announcePrices();
}

function announcePrices() {
  if (win && prices.pending() > 0) win.webContents.send("prices:available");
}

// ---- IPC: the site (preload.js) and the settings window (settings-preload.js) ----

let settingsWin = null;

function setupIpc() {
  // Only our own pages may call these.
  const fromSite = (e) => isInternal(e.senderFrame?.url || "");
  const fromSettings = (e) => settingsWin && !settingsWin.isDestroyed() && e.sender === settingsWin.webContents;

  ipcMain.handle("desktop:print-file", async (e, url, name) => {
    if (!fromSite(e) || !isInternal(url)) return { ok: false, error: "Недопустимый адрес файла" };
    try {
      return await printing.printFile(url, name);
    } catch (err) {
      return { ok: false, error: String(err?.message || err) };
    }
  });

  ipcMain.handle("prices:next", (e) => (fromSite(e) ? prices.next() : null));
  ipcMain.handle("prices:finish", (e, id, imported) => (fromSite(e) ? prices.finish(id, imported) : undefined));
  ipcMain.on("prices:subscribe", (e) => {
    if (fromSite(e) && prices.pending() > 0) e.sender.send("prices:available");
  });

  ipcMain.handle("settings:load", async (e) => {
    if (!fromSettings(e)) return null;
    const printers = win ? await win.webContents.getPrintersAsync() : [];
    return {
      settings: settings.get(),
      printers: printers.map((p) => ({ name: p.name, displayName: p.displayName, isDefault: p.isDefault })),
    };
  });
  ipcMain.handle("settings:save", (e, patch) => (fromSettings(e) ? settings.set(patch || {}) : null));
  ipcMain.handle("settings:pick-folder", async (e) => {
    if (!fromSettings(e)) return null;
    const r = await dialog.showOpenDialog(settingsWin, {
      title: "Папка прайсов",
      defaultPath: settings.get().pricesDir,
      properties: ["openDirectory", "createDirectory"],
    });
    return r.canceled ? null : r.filePaths[0];
  });
  ipcMain.handle("settings:open-folder", async (e) => {
    if (!fromSettings(e)) return;
    const dir = settings.get().pricesDir;
    fs.mkdirSync(dir, { recursive: true });
    await shell.openPath(dir);
  });
  ipcMain.handle("settings:test-print", (e) => (fromSettings(e) ? printing.testPrint() : null));
}

function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.show();
    settingsWin.focus();
    return;
  }
  settingsWin = new BrowserWindow({
    width: 560,
    height: 580,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: "Настройки EMV",
    icon: ICON_PATH,
    parent: win?.isVisible() ? win : undefined,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "settings-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  settingsWin.setMenu(null);
  settingsWin.loadFile(path.join(__dirname, "settings.html"));
  settingsWin.webContents.on("will-navigate", (ev) => ev.preventDefault());
}

function createWindow() {
  const state = readState();
  win = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    minWidth: 800,
    minHeight: 500,
    title: "EMV",
    icon: ICON_PATH,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#ffffff",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });
  if (state.maximized) win.maximize();
  win.once("ready-to-show", () => win.show());

  const wc = win.webContents;
  wc.setUserAgent(`${wc.getUserAgent()} EMVDesktop/${app.getVersion()}`);
  wc.session.setSpellCheckerLanguages(["ru", "en-US"]);

  // Links with target=_blank: our pages open as a new window, the rest in the browser.
  wc.setWindowOpenHandler(({ url }) => {
    if (isInternal(url)) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: { icon: ICON_PATH, autoHideMenuBar: true },
      };
    }
    openExternal(url);
    return { action: "deny" };
  });
  wc.on("will-navigate", (e, url) => {
    if (!isInternal(url)) {
      e.preventDefault();
      openExternal(url);
    }
  });

  // No connection / server down → local page with a retry button.
  wc.on("did-fail-load", (_e, code, desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return; // -3 = navigation aborted, not an error
    const retry = isInternal(url) ? url : HOME_URL;
    win.loadFile(path.join(__dirname, "offline.html"), {
      query: { retry, reason: desc },
    });
  });

  wc.on("context-menu", (_e, params) => buildContextMenu(params).popup({ window: win }));

  win.on("close", (e) => {
    saveState();
    // The cross hides to the tray so notifications keep arriving; quit from the tray menu.
    if (!quitting) {
      e.preventDefault();
      win.hide();
    }
  });

  win.loadURL(HOME_URL);
}

function buildContextMenu(params) {
  const items = [];
  for (const s of params.dictionarySuggestions.slice(0, 5)) {
    items.push({ label: s, click: () => win.webContents.replaceMisspelling(s) });
  }
  if (items.length) items.push({ type: "separator" });
  if (params.linkURL) {
    items.push(
      { label: "Открыть ссылку в браузере", click: () => openExternal(params.linkURL) },
      { label: "Копировать ссылку", click: () => clipboard.writeText(params.linkURL) },
      { type: "separator" },
    );
  }
  if (params.isEditable) {
    items.push(
      { label: "Вырезать", role: "cut", enabled: params.editFlags.canCut },
      { label: "Копировать", role: "copy", enabled: params.editFlags.canCopy },
      { label: "Вставить", role: "paste", enabled: params.editFlags.canPaste },
      { type: "separator" },
      { label: "Выделить всё", role: "selectAll" },
    );
  } else if (params.selectionText) {
    items.push({ label: "Копировать", role: "copy" });
  }
  if (items.length && items[items.length - 1].type !== "separator") items.push({ type: "separator" });
  items.push(
    { label: "Назад", enabled: win.webContents.navigationHistory.canGoBack(), click: () => win.webContents.navigationHistory.goBack() },
    { label: "Обновить", click: () => win.webContents.reload() },
    { label: "Печать…", click: () => win.webContents.print() },
  );
  return Menu.buildFromTemplate(items);
}

// Hidden menu bar (Alt shows it); mainly here for the keyboard shortcuts.
function createMenu() {
  const focused = () => BrowserWindow.getFocusedWindow();
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "Файл",
        submenu: [
          { label: "Главная", accelerator: "Alt+Home", click: () => focused()?.loadURL(HOME_URL) },
          { label: "Печать…", accelerator: "CmdOrCtrl+P", click: () => focused()?.webContents.print() },
          { type: "separator" },
          { label: "Настройки…", accelerator: "CmdOrCtrl+,", click: openSettings },
          { type: "separator" },
          { label: "Выход", accelerator: "CmdOrCtrl+Q", click: quit },
        ],
      },
      {
        label: "Правка",
        submenu: [
          { label: "Отменить", role: "undo" },
          { label: "Повторить", role: "redo" },
          { type: "separator" },
          { label: "Вырезать", role: "cut" },
          { label: "Копировать", role: "copy" },
          { label: "Вставить", role: "paste" },
          { label: "Выделить всё", role: "selectAll" },
        ],
      },
      {
        label: "Вид",
        submenu: [
          { label: "Назад", accelerator: "Alt+Left", click: () => focused()?.webContents.navigationHistory.goBack() },
          { label: "Вперёд", accelerator: "Alt+Right", click: () => focused()?.webContents.navigationHistory.goForward() },
          { label: "Обновить", accelerator: "F5", click: () => focused()?.webContents.reload() },
          { label: "Обновить", accelerator: "CmdOrCtrl+R", visible: false, click: () => focused()?.webContents.reload() },
          { type: "separator" },
          { label: "Крупнее", role: "zoomIn", accelerator: "CmdOrCtrl+=" },
          { label: "Мельче", role: "zoomOut" },
          { label: "Обычный размер", role: "resetZoom" },
          { type: "separator" },
          { label: "Во весь экран", role: "togglefullscreen" },
          { label: "Инструменты разработчика", accelerator: "CmdOrCtrl+Shift+I", role: "toggleDevTools" },
        ],
      },
      {
        label: "Справка",
        submenu: [
          { label: "Проверить обновления", click: () => checkForUpdates(true) },
          { label: `Версия ${app.getVersion()}`, enabled: false },
        ],
      },
    ]),
  );
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(ICON_PATH).resize({ width: 16, height: 16 }));
  tray.setToolTip("EMV");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Открыть EMV", click: showWindow },
      { label: "Обновить страницу", click: () => win?.webContents.reload() },
      { type: "separator" },
      { label: "Загрузить прайсы из папки", click: () => { prices.retrySkipped(); openPriceCheck(); } },
      { label: "Открыть папку прайсов", click: () => shell.openPath(settings.get().pricesDir) },
      { type: "separator" },
      { label: "Настройки…", click: openSettings },
      { label: "Проверить обновления", click: () => checkForUpdates(true) },
      { type: "separator" },
      { label: "Выход", click: quit },
    ]),
  );
  tray.on("click", showWindow);
}

function quit() {
  quitting = true;
  app.quit();
}

app.on("before-quit", () => {
  quitting = true;
  saveState();
});

// ---- auto-update: latest.yml + installer live at https://emv.one/desktop/ ----

let manualCheck = false;

function setupUpdates() {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-downloaded", async (info) => {
    const { response } = await dialog.showMessageBox(win, {
      type: "info",
      buttons: ["Перезапустить сейчас", "Позже"],
      defaultId: 0,
      cancelId: 1,
      title: "Обновление EMV",
      message: `Загружена новая версия ${info.version}.`,
      detail: "Она установится при перезапуске программы.",
    });
    if (response === 0) {
      quitting = true;
      autoUpdater.quitAndInstall();
    }
  });
  autoUpdater.on("update-not-available", () => {
    if (manualCheck) {
      dialog.showMessageBox(win, { type: "info", title: "EMV", message: "У вас последняя версия программы." });
    }
  });
  autoUpdater.on("error", (err) => {
    if (manualCheck) {
      dialog.showMessageBox(win, { type: "warning", title: "EMV", message: "Не удалось проверить обновления.", detail: String(err?.message || err) });
    }
  });

  checkForUpdates(false);
  setInterval(() => checkForUpdates(false), 4 * 60 * 60 * 1000);
}

function checkForUpdates(manual) {
  if (!app.isPackaged) {
    if (manual) dialog.showMessageBox(win, { type: "info", title: "EMV", message: "Обновления работают только в установленной программе." });
    return;
  }
  manualCheck = manual;
  // Updates are served to signed-in staff only: pass the window's session on.
  session.defaultSession.cookies
    .get({ url: START_URL, name: "emv_admin_session" })
    .then(([cookie]) => {
      if (!cookie) {
        if (manual) dialog.showMessageBox(win, { type: "info", title: "EMV", message: "Войдите в CRM, чтобы проверить обновления." });
        return;
      }
      autoUpdater.requestHeaders = { Cookie: `${cookie.name}=${cookie.value}` };
      return autoUpdater.checkForUpdates();
    })
    .catch(() => {});
}
