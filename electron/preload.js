/**
 * Preload for the BillBharat window. The page stays sandboxed; it only gets
 * these calls, which go to electron/main.js. Outside the desktop app the
 * object is missing and the settings page hides the update card. savePdf opens
 * the native Save As dialog for a PDF the page has built.
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("billbharatDesktop", {
  checkForUpdates: () => ipcRenderer.invoke("update:check"),
  installUpdate: () => ipcRenderer.invoke("update:install"),
  savePdf: (name, data) => ipcRenderer.invoke("pdf:save", { name, data })
});
