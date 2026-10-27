// «Печать» in CRM → Заказы → documents: the file is downloaded with the
// window's cookies and sent to the chosen printer without a dialog
// (SumatraPDF from pdf-to-printer; it prints PDF and images).
const path = require("node:path");
const fs = require("node:fs/promises");
const { app, session } = require("electron");
const { print } = require("pdf-to-printer");
const settings = require("./settings");

const PRINTABLE = /\.(pdf|png|jpe?g|gif|webp)$/i;

async function printFile(url, name) {
  const ext = path.extname(String(name || "")).toLowerCase();
  if (!PRINTABLE.test(ext)) return { ok: false, error: "Печатать можно PDF и изображения" };

  const res = await session.defaultSession.fetch(url);
  if (!res.ok) return { ok: false, error: `Не удалось получить файл (${res.status})` };

  const dir = path.join(app.getPath("temp"), "emv-print");
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${Date.now()}${ext}`);
  await fs.writeFile(file, Buffer.from(await res.arrayBuffer()));
  try {
    const printer = settings.get().printer;
    await print(file, { ...(printer ? { printer } : {}), scale: "fit", silent: true });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `Ошибка печати: ${e?.message || e}` };
  } finally {
    // Sumatra may still hold the file for a moment.
    setTimeout(() => fs.unlink(file).catch(() => {}), 60_000);
  }
}

/** Настройки → «Пробная печать»: a one-page PDF made on the spot. */
async function testPrint() {
  const { BrowserWindow } = require("electron");
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  try {
    const html = `<!doctype html><meta charset="utf-8"><body style="font:16px Arial;padding:40px">
      <div style="display:inline-block;border:6px solid #000;padding:6px 16px;font:800 32px Arial">EMV</div>
      <p>Пробная страница программы EMV.</p><p>${new Date().toLocaleString("ru-RU")}</p></body>`;
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const pdf = await win.webContents.printToPDF({ pageSize: "A4" });
    const dir = path.join(app.getPath("temp"), "emv-print");
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, `test-${Date.now()}.pdf`);
    await fs.writeFile(file, pdf);
    const printer = settings.get().printer;
    await print(file, { ...(printer ? { printer } : {}), silent: true });
    setTimeout(() => fs.unlink(file).catch(() => {}), 60_000);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `Ошибка печати: ${e?.message || e}` };
  } finally {
    win.destroy();
  }
}

module.exports = { printFile, testPrint };
