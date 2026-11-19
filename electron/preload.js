/**
 * Preload for the BillBharat window. The page stays sandboxed; it only gets
 * these two calls, which go to electron/main.js. Outside the desktop app the
 * object is missing and the settings page hides the update card.
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("billbharatDesktop", {
  checkForUpdates: () => ipcRenderer.invoke("update:check"),
  installUpdate: () => ipcRenderer.invoke("update:install")
});
