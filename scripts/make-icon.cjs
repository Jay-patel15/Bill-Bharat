const { app, BrowserWindow } = require("electron");
const fs = require("fs");
// Renders electron/icon.svg to electron/icon.png (512 px); run `npm run icon` after editing the SVG, then copy the SVG to app/icon.svg.
const path = require("path");
const svgPath = path.join(__dirname, "..", "electron", "icon.svg");
const outPath = path.join(__dirname, "..", "electron", "icon.png");
app.whenReady().then(async () => {
  const w = new BrowserWindow({ width: 512, height: 512, show: false, frame: false, transparent: true, useContentSize: true, webPreferences: { offscreen: true } });
  const svg = fs.readFileSync(svgPath, "utf8");
  await w.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(`<style>html,body{margin:0;background:transparent}</style>${svg}`));
  await new Promise((r) => setTimeout(r, 400));
  const img = await w.webContents.capturePage({ x: 0, y: 0, width: 512, height: 512 });
  fs.writeFileSync(outPath, img.resize({ width: 512, height: 512 }).toPNG());
  app.quit();
});
