/**
 * electron-builder afterPack hook: writes build/icon.ico into BillBharat.exe,
 * so the program, its taskbar button and the desktop shortcut show the BillBharat sign.
 * Done here because electron-builder's own icon step (signAndEditExecutable) downloads
 * a code-signing toolkit that needs Windows symlink rights many PCs do not grant.
 */
const path = require("node:path");
const rcedit = require("rcedit");

module.exports = async function setExeIcon(context) {
  if (context.electronPlatformName !== "win32") return;
  const exe = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`);
  await rcedit(exe, { icon: path.join(context.packager.projectDir, "build", "icon.ico") });
  console.log(`icon set on ${path.basename(exe)}`);
};
