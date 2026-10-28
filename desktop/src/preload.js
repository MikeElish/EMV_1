// What the site sees as window.emvDesktop (types: src/lib/desktop.ts of the site).
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("emvDesktop", {
  isDesktop: true,
  platform: process.platform,
  printFile: (url, name) => ipcRenderer.invoke("desktop:print-file", String(url), String(name)),
  zoom: {
    get: () => ipcRenderer.invoke("desktop:zoom-get"),
    set: (percent) => ipcRenderer.invoke("desktop:zoom-set", Number(percent)),
    onChange: (callback) => {
      const handler = (_e, percent) => callback(percent);
      ipcRenderer.on("desktop:zoom", handler);
      return () => ipcRenderer.removeListener("desktop:zoom", handler);
    },
  },
  prices: {
    next: () => ipcRenderer.invoke("prices:next"),
    finish: (id, imported) => ipcRenderer.invoke("prices:finish", String(id), Boolean(imported)),
    onAvailable: (callback) => {
      const handler = () => callback();
      ipcRenderer.on("prices:available", handler);
      ipcRenderer.send("prices:subscribe"); // answered at once when files are waiting
      return () => ipcRenderer.removeListener("prices:available", handler);
    },
  },
});
