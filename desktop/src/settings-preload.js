// Bridge for the local settings window (settings.html) only.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("emvSettings", {
  load: () => ipcRenderer.invoke("settings:load"),
  save: (patch) => ipcRenderer.invoke("settings:save", patch),
  pickFolder: () => ipcRenderer.invoke("settings:pick-folder"),
  openFolder: () => ipcRenderer.invoke("settings:open-folder"),
  testPrint: () => ipcRenderer.invoke("settings:test-print"),
});
