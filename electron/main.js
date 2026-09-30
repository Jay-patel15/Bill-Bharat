/**
 * electron/main.js — desktop shell for BillBharat.
 *
 * Boots the Next.js standalone server on a free loopback port in a child
 * process, then points a BrowserWindow at it. Nothing listens on an external
 * interface and nothing leaves the machine.
 *
 * The books live in %APPDATA%\BillBharat\data — a subfolder, kept clear of
 * Electron's own Chromium caches so the whole of it can be copied as a
 * backup. Reinstalling or updating the app never touches it.
 *
 * Unpackaged (`npm run dev:app`) it attaches to the `npm run dev` server on
 * localhost:3000 instead of spawning its own, so hot reload still works.
 * Override the target with BB_DEV_URL.
 */

const { app, BrowserWindow, Menu, shell, dialog } = require("electron");
const { fork } = require("node:child_process");
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
 * first launch, not baked into the build — a shipped secret would be the
 * same for every install.
 */
function sessionSecret() {
  const file = path.join(app.getPath("userData"), "session-secret");
  try {
    const existing = fs.readFileSync(file, "utf8").trim();
    if (existing) return existing;
  } catch {
    // First launch — fall through and create it.
  }
  const secret = crypto.randomBytes(32).toString("hex");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, secret, { mode: 0o600 });
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
      BILLBHARAT_DATA_DIR: booksDir(),
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
const SPLASH = `data:text/html,${encodeURIComponent(`
<style>
  html,body{height:100%;margin:0}
  body{display:grid;place-content:center;justify-items:center;gap:18px;
       font:15px/1.4 "Segoe UI",system-ui,sans-serif;color:#0f172a;background:#fff}
  .mark{width:52px;height:52px;border-radius:10px;background:#0f172a;color:#fff;
        display:grid;place-content:center;font-weight:700;font-size:26px}
  .bar{width:180px;height:3px;border-radius:3px;background:#e2e8f0;overflow:hidden}
  .bar i{display:block;width:40%;height:100%;background:#0f172a;animation:s 1.1s ease-in-out infinite}
  @keyframes s{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}
  small{color:#64748b}
  @media (prefers-color-scheme:dark){
    body{background:#0f172a;color:#f1f5f9}
    .mark{background:#f1f5f9;color:#0f172a}
    .bar{background:#1e293b}.bar i{background:#f1f5f9}
    small{color:#94a3b8}
  }
</style>
<div class="mark">B</div>
<div>Starting BillBharat…</div>
<div class="bar"><i></i></div>
<small>Loading your local books</small>
`)}`;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: "#ffffff",
    title: "BillBharat",
    webPreferences: {
      // The page is ordinary web content served over loopback; it needs no
      // access to Node from the renderer.
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
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

function buildMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: "File",
      submenu: [
        { role: "reload" },
        { label: "Print…", accelerator: "CmdOrCtrl+P", click: () => mainWindow?.webContents.print() },
        { type: "separator" },
        {
          label: "Open Data Folder",
          click: () => shell.openPath(booksDir())
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
    buildMenu();
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
