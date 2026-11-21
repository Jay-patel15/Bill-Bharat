/**
 * electron/main.js — desktop shell for BillBharat.
 *
 * Boots the Next.js standalone server on a free loopback port in a child
 * process, then points a BrowserWindow at it. Nothing listens on an external
 * interface. The only outbound request is the update check, made when the user
 * presses Check for updates in Settings.
 *
 * The books live in %APPDATA%\BillBharat\data — a subfolder, kept clear of
 * Electron's own Chromium caches so the whole of it can be copied as a
 * backup. Reinstalling or updating the app never touches it.
 *
 * Unpackaged (`npm run dev:app`) it attaches to the `npm run dev` server on
 * localhost:3000 instead of spawning its own, so hot reload still works.
 * Override the target with BB_DEV_URL.
 */

const { app, BrowserWindow, Menu, shell, dialog, session, safeStorage, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const { execFile, fork } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

const DEV_URL = process.env.BB_DEV_URL || (app.isPackaged ? "" : "http://localhost:3000");
const isDev = Boolean(DEV_URL);

let serverProcess = null;
let mainWindow = null;
let appUrl = DEV_URL;

/** billbharat.db and files/ — everything worth backing up, and nothing else. */
function booksDir() {
  const dir = path.join(app.getPath("userData"), "data");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * The session cookie is signed with a secret generated on this machine at
 * first launch, not baked into the build. It is stored encrypted with
 * Electron safeStorage (Windows DPAPI: readable only by this Windows user).
 * The Gemini API key is in turn encrypted with a key derived from this
 * secret, so both are protected by the user's Windows login.
 */
function sessionSecret() {
  const dir = app.getPath("userData");
  const sealed = path.join(dir, "session-secret.enc");
  const legacy = path.join(dir, "session-secret");
  const canSeal = safeStorage.isEncryptionAvailable();

  if (fs.existsSync(sealed)) return safeStorage.decryptString(fs.readFileSync(sealed));

  let secret = "";
  try { secret = fs.readFileSync(legacy, "utf8").trim(); } catch { /* first launch */ }
  if (!secret) secret = crypto.randomBytes(32).toString("hex");

  fs.mkdirSync(dir, { recursive: true });
  if (canSeal) {
    fs.writeFileSync(sealed, safeStorage.encryptString(secret));
    fs.rmSync(legacy, { force: true }); // migrate the old plain-text file
  } else {
    fs.writeFileSync(legacy, secret, { mode: 0o600 }); // no OS keystore available
  }
  return secret;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function waitForServer(url, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() > deadline) return reject(new Error("Server did not start in time"));
        setTimeout(attempt, 150);
      });
      req.setTimeout(2000, () => req.destroy());
    };
    attempt();
  });
}

async function startServer() {
  const port = await freePort();
  const serverDir = path.join(process.resourcesPath, "server");
  const entry = path.join(serverDir, "server.js");

  if (!fs.existsSync(entry)) {
    throw new Error(`Server bundle missing at ${entry}. Run "npm run build" before packaging.`);
  }

  serverProcess = fork(entry, [], {
    cwd: serverDir,
    env: {
      ...process.env,
      NODE_ENV: "production",
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
      JWT_SECRET: sessionSecret(),
      // Lets the server snapshot the books before a new version touches them.
      BILLBHARAT_APP_VERSION: app.getVersion(),
      NEXT_TELEMETRY_DISABLED: "1",
      BILLBHARAT_DATA_DIR: booksDir(),
      // Snapshots live beside the books, not inside them, so restoring a copied
      // data folder never wipes the safety copies.
      BILLBHARAT_BACKUP_DIR: path.join(app.getPath("userData"), "backups"),
      // Runs the child under Electron's bundled Node rather than as a second
      // Electron GUI process.
      ELECTRON_RUN_AS_NODE: "1"
    },
    stdio: ["ignore", "pipe", "pipe", "ipc"]
  });

  serverProcess.stdout?.on("data", (d) => console.log("[server]", d.toString().trim()));
  serverProcess.stderr?.on("data", (d) => console.error("[server]", d.toString().trim()));
  serverProcess.on("exit", (code) => {
    serverProcess = null;
    // A server that dies takes the app with it; staying open would just show
    // a blank window with no way to recover.
    if (code !== 0 && !app.isQuitting) {
      dialog.showErrorBox("BillBharat", `The application server stopped unexpectedly (code ${code}).`);
      app.quit();
    }
  });

  appUrl = `http://127.0.0.1:${port}`;
  await waitForServer(appUrl);
}

/**
 * Shown from the moment the window opens until the server answers. Booting
 * the Next server takes a few seconds installed, and the portable build
 * self-extracts ~88 MB first, so without this the user stares at nothing and
 * concludes the app failed to start.
 */
const SPLASH = `data:text/html;charset=utf-8,${encodeURIComponent(`
<meta charset="utf-8">
<style>
  html,body{height:100%;margin:0}
  body{display:grid;place-content:center;justify-items:center;gap:18px;
       font:15px/1.4 "Segoe UI",system-ui,sans-serif;color:#0f172a;background:#fff}
  .mark{width:72px;height:72px}
  .bar{width:180px;height:3px;border-radius:3px;background:#e2e8f0;overflow:hidden}
  .bar i{display:block;width:40%;height:100%;background:#0f172a;animation:s 1.1s ease-in-out infinite}
  @keyframes s{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}
  small{color:#64748b}
</style>
<img class="mark" alt="" src="data:image/svg+xml;base64,${fs.readFileSync(path.join(__dirname, "icon.svg")).toString("base64")}">
<div>Starting BillBharat…</div>
<div class="bar"><i></i></div>
<small>Loading your local books</small>
`)}`;

/**
 * The window may only load the local server and in-memory content. Links to
 * other sites (WhatsApp share, AI Studio) open in the user's browser via the
 * handlers below; nothing remote loads inside the app.
 */
function lockDownNetwork() {
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url;
    // chrome:// and chrome-untrusted:// are Chromium's own built-in pages (the PDF viewer loads its UI from them); never the network.
    if (/^(data|blob|devtools|chrome-extension|chrome|chrome-untrusted):/.test(url)) return callback({});
    // Same host as the app server, any scheme: covers http and the dev hot-reload websocket.
    const local = Boolean(appUrl) && new URL(url).host === new URL(appUrl).host;
    callback({ cancel: !local });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: "#ffffff",
    title: "BillBharat",
    icon: path.join(__dirname, "icon.png"),
    webPreferences: {
      // The page is ordinary web content served over loopback; it needs no
      // access to Node from the renderer.
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, "preload.js")
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  // PDFs and other in-app documents open in a child window (Chromium's PDF
  // viewer, so printing works). Anything off-origin — WhatsApp share links,
  // for instance — goes to the real browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(appUrl)) return { action: "allow" };
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(appUrl)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.on("closed", () => { mainWindow = null; });
  mainWindow.loadURL(SPLASH);
}

/**
 * Settings → Check for updates. Only runs when the user presses the button; the
 * installer is downloaded from the GitHub release and the app restarts into it.
 * The database is untouched: it lives in the user's profile, and the server
 * backs it up before a new version runs.
 */
function registerUpdater() {
  autoUpdater.autoDownload = false;

  ipcMain.handle("update:check", async () => {
    if (!app.isPackaged) return { status: "dev", version: app.getVersion() };
    try {
      const result = await autoUpdater.checkForUpdates();
      if (!result?.isUpdateAvailable) return { status: "latest", version: app.getVersion() };
      return { status: "available", version: result.updateInfo.version };
    } catch (e) {
      return { status: "error", message: e.message };
    }
  });

  ipcMain.handle("update:install", async () => {
    try {
      await autoUpdater.downloadUpdate();
      // Silent install; quitting first lets the server stop and release the database.
      setImmediate(() => autoUpdater.quitAndInstall(true, true));
      return { status: "installing" };
    } catch (e) {
      return { status: "error", message: e.message };
    }
  });
}

/**
 * Save a PDF where the user chooses (the native Save As dialog). The page sends the bytes;
 * nothing is written until the user picks a file.
 */
function registerPdfSave() {
  ipcMain.handle("pdf:save", async (_event, { name, data }) => {
    const safe = String(name || "document.pdf").replace(/[\/:*?"<>|]/g, "-");
    const options = {
      defaultPath: path.join(app.getPath("documents"), safe),
      filters: [{ name: "PDF", extensions: ["pdf"] }]
    };
    const { canceled, filePath } = mainWindow
      ? await dialog.showSaveDialog(mainWindow, options)
      : await dialog.showSaveDialog(options);
    if (canceled || !filePath) return { saved: false };
    await fs.promises.writeFile(filePath, Buffer.from(data));
    return { saved: true, path: filePath };
  });
}

/**
 * WhatsApp cannot take a file from a link. The PDF is saved to Downloads\BillBharat, copied to the
 * Windows clipboard as a file (paste it into the chat with Ctrl+V), and its folder is opened so it
 * can also be dragged in. The clipboard copy is Windows-only; elsewhere only the folder opens.
 */
function registerPdfShare() {
  ipcMain.handle("pdf:share", async (_event, { name, data }) => {
    const safe = String(name || "invoice.pdf").replace(/[\\/:*?"<>|]/g, "-");
    const dir = path.join(app.getPath("downloads"), "BillBharat");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, safe);
    await fs.promises.writeFile(file, Buffer.from(data));

    let copied = false;
    if (process.platform === "win32") {
      // The path goes in an environment variable, not the command line, so no quoting can break it.
      copied = await new Promise((resolve) => {
        execFile(
          "powershell.exe",
          ["-NoProfile", "-NonInteractive", "-STA", "-Command", "Set-Clipboard -Path $env:BB_PDF"],
          { env: { ...process.env, BB_PDF: file }, windowsHide: true, timeout: 20000 },
          (err) => resolve(!err)
        );
      });
    }
    shell.showItemInFolder(file);
    return { path: file, copied };
  });
}

function buildMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: "File",
      submenu: [
        { role: "reload" },
        // A page that handles "app-print" (the sale page prints its invoice) cancels the event; otherwise print the page.
        { label: "Print…", accelerator: "CmdOrCtrl+P", click: async () => {
          const handled = await mainWindow?.webContents.executeJavaScript(`!window.dispatchEvent(new Event("app-print", { cancelable: true }))`);
          if (!handled) mainWindow?.webContents.print();
        } },
        { type: "separator" },
        {
          label: "Open Data Folder",
          click: () => shell.openPath(booksDir())
        },
        {
          label: "Open Backups Folder",
          click: () => {
            const dir = path.join(app.getPath("userData"), "backups");
            fs.mkdirSync(dir, { recursive: true });
            shell.openPath(dir);
          }
        },
        { type: "separator" },
        { role: "quit" }
      ]
    },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
        { role: "toggleDevTools" }
      ]
    }
  ]));
}

// One instance, one server, one database writer.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    // Windows groups the taskbar button and shortcuts by this id; it keeps the BillBharat icon on them.
    app.setAppUserModelId("com.billbharat.desktop");
    buildMenu();
    registerUpdater();
    registerPdfSave();
    registerPdfShare();
    lockDownNetwork();
    createWindow();
    try {
      if (!isDev) await startServer();
      else await waitForServer(appUrl);
      // The window may already be gone if the user closed the splash.
      mainWindow?.loadURL(appUrl);
    } catch (err) {
      dialog.showErrorBox("BillBharat failed to start", err.message);
      app.quit();
    }
  });

  app.on("before-quit", () => { app.isQuitting = true; });
  app.on("will-quit", () => { serverProcess?.kill(); });
  app.on("window-all-closed", () => app.quit());
}
