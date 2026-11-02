/**
 * lib/db/sqlite.js — local SQLite connection + query helpers.
 *
 * Drop-in replacement for the old Postgres pool: exposes the same
 * query() / queryOne() surface, so lib/db.js keeps generating the same SQL.
 *
 * Driver is node-sqlite3-wasm (SQLite compiled to WebAssembly) rather than a
 * native addon, so the exact same node_modules works under plain Node (`npm
 * run dev`) and under Electron in the packaged exe — no per-ABI rebuild, no
 * MSVC/python toolchain. Costs ~1.7x vs better-sqlite3 on synthetic
 * benchmarks, which is still sub-millisecond per indexed query locally and
 * far quicker than any network round-trip.
 *
 * The driver is synchronous. Every query runs to completion without yielding
 * to the event loop, so concurrent requests in one Next.js process cannot
 * interleave mid-statement and no application-level locking is needed.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sqlite3 from "node-sqlite3-wasm";
import { dataDir, dbPath, filesDir } from "../paths.js";
import { MIGRATIONS } from "./schema.js";

const { Database } = sqlite3;

let _db = null;
let _stmts = new Map();

// ponytail: flush-all statement cache. SQL shapes are generated from a small
// fixed set in lib/db.js, so the cap is a runaway guard, not a hot path.
// Swap for an LRU only if profiling shows repeated re-prepares.
const STMT_CACHE_MAX = 300;

function getDb() {
  if (_db) return _db;

  const db = new Database(dbPath());

  // WAL lets reads proceed during writes; FULL fsyncs every commit, so a
  // Windows crash or power cut cannot lose a bill that was already saved.
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA synchronous = FULL");
  db.run("PRAGMA foreign_keys = ON");
  db.run("PRAGMA busy_timeout = 5000");
  db.run("PRAGMA cache_size = -64000"); // 64 MB page cache
  db.run("PRAGMA temp_store = MEMORY");

  migrate(db);

  _db = db;
  return _db;
}

/**
 * Versioned migrations tracked in _schema_migrations. Before touching an
 * existing database (new app version or pending migration) a checksummed
 * snapshot is written to <data>/backups. Each migration runs in its own
 * transaction, so a failure rolls back and leaves the file as it was.
 */
function migrate(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS _schema_migrations (version INTEGER PRIMARY KEY, "appliedAt" TEXT NOT NULL);
           CREATE TABLE IF NOT EXISTS _app_meta (key TEXT PRIMARY KEY, value TEXT)`);
  const done = new Set(db.all("SELECT version FROM _schema_migrations").map((r) => r.version));
  const pending = MIGRATIONS.filter((m) => !done.has(m.version));
  const hasBooks = db.get("SELECT 1 AS x FROM sqlite_master WHERE name = 'users'");
  const appVersion = process.env.BILLBHARAT_APP_VERSION || "";
  const lastVersion = db.get("SELECT value FROM _app_meta WHERE key = 'appVersion'")?.value || "";

  if (hasBooks && (pending.length || (appVersion && appVersion !== lastVersion))) {
    snapshot(db, `backup_v${lastVersion || "unknown"}`);
  }

  for (const m of pending) {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(m.sql);
      db.run(`INSERT INTO _schema_migrations (version, "appliedAt") VALUES (?, ?)`, [m.version, new Date().toISOString()]);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw new Error(`Migration ${m.version} failed and was rolled back: ${e.message}`);
    }
  }
  if (appVersion) db.run("INSERT OR REPLACE INTO _app_meta (key, value) VALUES ('appVersion', ?)", [appVersion]);
}

export function backupsDir() {
  const dir = process.env.BILLBHARAT_BACKUP_DIR?.trim() || path.join(dataDir(), "backups");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const KEEP_PER_KIND = 30; // per label (daily, manual, backup_v…), in every backup folder

const meta = (db, key) => db.get("SELECT value FROM _app_meta WHERE key = ?", [key])?.value || "";
const setMeta = (db, key, value) => db.run("INSERT OR REPLACE INTO _app_meta (key, value) VALUES (?, ?)", [key, String(value)]);
const kindOf = (f) => f.replace(/_\d{4}-\d{2}-\d{2}T[\d-]+Z\.db$/, "");

/** Keep the newest KEEP_PER_KIND backups of each kind in `dir`. */
function prune(dir) {
  const byKind = new Map();
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".db")).sort().reverse()) {
    const list = byKind.get(kindOf(f)) || [];
    list.push(f);
    byKind.set(kindOf(f), list);
  }
  for (const f of [...byKind.values()].flatMap((l) => l.slice(KEEP_PER_KIND))) {
    fs.rmSync(path.join(dir, f), { force: true });
    fs.rmSync(path.join(dir, `${f}.sha256`), { force: true });
  }
}

/** Every file under `dir` as [relative path with /, absolute path]. */
function walk(dir, rel = "") {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name), `${rel}${e.name}/`) : [[`${rel}${e.name}`, path.join(dir, e.name)]]);
}

/** Extra backup folders (cloud-synced, USB, other drive, network share) chosen in Settings. */
export function backupFolders(db = getDb()) {
  try { return JSON.parse(meta(db, "backupFolders") || "[]"); } catch { return []; }
}

export function setBackupFolders(folders, db = getDb()) {
  setMeta(db, "backupFolders", JSON.stringify(folders));
}

/**
 * Copy one snapshot (+ checksum) to every extra folder, in the background:
 * a slow pen drive, network share or cloud folder never blocks saving.
 * Copies run one after another; a missing folder is reported, never fatal.
 */
let offsiteQueue = Promise.resolve();
export const offsiteIdle = () => offsiteQueue; // resolves when queued copies are done (tests, shutdown)

async function pruneAsync(dir) {
  const files = (await fs.promises.readdir(dir)).filter((f) => f.endsWith(".db")).sort().reverse();
  const seen = new Map();
  for (const f of files) {
    const n = (seen.get(kindOf(f)) || 0) + 1;
    seen.set(kindOf(f), n);
    if (n > KEEP_PER_KIND) for (const x of [f, `${f}.sha256`]) await fs.promises.rm(path.join(dir, x), { force: true });
  }
}

function copyOffsite(db, file) {
  const folders = backupFolders(db);
  if (!folders.length) return offsiteQueue;
  offsiteQueue = offsiteQueue.then(async () => {
    const errors = [];
    let copied = 0;
    for (const dir of folders) {
      try {
        await fs.promises.mkdir(dir, { recursive: true });
        for (const f of [file, `${file}.sha256`]) await fs.promises.copyFile(f, path.join(dir, path.basename(f)));
        await pruneAsync(dir);
        copied++;
      } catch (e) { errors.push(`${dir}: ${e.code || e.message}`); }
    }
    const live = getDb(); // the connection may have been reopened (restore) while copying
    if (copied) setMeta(live, "lastOffsite", new Date().toISOString());
    setMeta(live, "lastOffsiteError", errors.join("; "));
  }).catch((e) => console.error("Backup copy failed:", e.message));
  return offsiteQueue;
}

/**
 * Consistent copy of the open database (VACUUM INTO is safe while in use)
 * with every uploaded file (logo, bill photos) packed inside it in the
 * _backup_files table, a .sha256 file next to it, and a copy in each extra
 * backup folder. Returns the snapshot path.
 */
export function snapshot(db = getDb(), label = "backup") {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(backupsDir(), `${label}_${stamp}.db`);
  db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);

  const copy = new Database(file);
  try {
    copy.exec(`CREATE TABLE _backup_files (path TEXT PRIMARY KEY, data BLOB NOT NULL)`);
    for (const [rel, abs] of walk(filesDir())) copy.run("INSERT INTO _backup_files (path, data) VALUES (?, ?)", [rel, fs.readFileSync(abs)]);
  } finally { copy.close(); }

  const sum = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  fs.writeFileSync(`${file}.sha256`, `${sum}  ${path.basename(file)}
`);
  prune(backupsDir());
  copyOffsite(db, file);
  return file;
}

/** One "daily" snapshot per calendar day; called when the app opens and hourly while it stays open. */
export function dailyBackup(db = getDb()) {
  const today = new Date().toISOString().slice(0, 10);
  if (meta(db, "lastDaily") === today) return null;
  const file = snapshot(db, "daily");
  setMeta(db, "lastDaily", today);
  return file;
}

export function backupStatus(db = getDb()) {
  return {
    folders: backupFolders(db),
    localDir: backupsDir(),
    lastDaily: meta(db, "lastDaily"),
    lastOffsite: meta(db, "lastOffsite"),
    lastOffsiteError: meta(db, "lastOffsiteError")
  };
}

/**
 * Replace the live database with a backup file. The candidate is opened and
 * integrity-checked first; the current books are snapshotted before the swap.
 * Uploaded files packed in the backup are written back; existing files are kept.
 */
export function restoreFrom(candidatePath) {
  const head = fs.readFileSync(candidatePath).subarray(0, 16).toString("latin1");
  if (head !== "SQLite format 3\0") throw new Error("Not a BillBharat backup file");
  const probe = new Database(candidatePath);
  try {
    if (probe.get("PRAGMA integrity_check")?.integrity_check !== "ok") throw new Error("Backup file is damaged");
    if (!probe.get("SELECT 1 AS x FROM sqlite_master WHERE name = 'users'")) throw new Error("Not a BillBharat backup file");
  } finally {
    probe.close();
  }
  const folders = backupFolders(); // where to back up is a setting of this PC, not of the backup
  snapshot(getDb(), "before_restore");
  closeDb();
  for (const ext of ["-wal", "-shm"]) fs.rmSync(dbPath() + ext, { force: true });
  fs.copyFileSync(candidatePath, dbPath());

  const restored = new Database(dbPath());
  try {
    if (restored.get("SELECT 1 AS x FROM sqlite_master WHERE name = '_backup_files'")) {
      const root = path.resolve(filesDir());
      for (const { path: rel, data } of restored.all("SELECT path, data FROM _backup_files")) {
        const dest = path.resolve(root, rel);
        if (!dest.startsWith(root + path.sep)) continue; // a crafted backup must not write outside the files folder
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, data);
      }
      restored.exec("DROP TABLE _backup_files");
    }
  } finally { restored.close(); }

  setBackupFolders(folders, getDb()); // getDb reopens + runs any migrations (and creates _app_meta) the older backup needs
}

let _txDepth = 0;

/**
 * Run fn inside one transaction. Safe across awaits because the driver is
 * synchronous: as long as fn only awaits DB calls, no other request's
 * statements can run in between. Nested calls join the outer transaction.
 */
export async function transaction(fn) {
  const db = getDb();
  if (_txDepth > 0) return fn();
  db.exec("BEGIN IMMEDIATE");
  _txDepth++;
  try {
    const result = await fn();
    db.exec("COMMIT");
    return result;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  } finally {
    _txDepth--;
  }
}

/**
 * Postgres-style $1, $2 → SQLite numbered ?1, ?2, so a placeholder used
 * twice binds the same value (plain `?` would shift every later param).
 */
function toSqlitePlaceholders(sql) {
  return sql.replace(/\$(\d+)/g, "?$1");
}

/**
 * SQLite binds only null / number / string / bigint / Uint8Array. Normalise
 * the types the app can realistically hand us so a stray boolean or Date
 * surfaces as stored data rather than a 500.
 */
function bindable(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && !(value instanceof Uint8Array)) {
    return JSON.stringify(value);
  }
  return value;
}

/**
 * sqlite3_finalize() returns the error code of that statement's last failed
 * execution, so finalizing a statement that once hit a constraint violation
 * (a duplicate email, a bad foreign key) throws all over again. The original
 * failure was already reported to the caller that caused it; re-raising it
 * here would fail an unrelated request. Nothing to do but drop it.
 */
function discard(stmt) {
  try {
    stmt.finalize();
  } catch {
    // Stale error from an already-reported failure.
  }
}

function prepared(sql) {
  const cached = _stmts.get(sql);
  if (cached) return cached;

  if (_stmts.size >= STMT_CACHE_MAX) {
    for (const stmt of _stmts.values()) discard(stmt);
    _stmts.clear();
  }

  const stmt = getDb().prepare(sql);
  _stmts.set(sql, stmt);
  return stmt;
}

/**
 * query() — run a single parameterised statement, returns rows[].
 * Async signature kept so every existing `await query(...)` call site works.
 */
export async function query(sql, params = []) {
  const stmt = prepared(toSqlitePlaceholders(sql));
  return stmt.all(params.map(bindable));
}

export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] ?? null;
}

export function closeDb() {
  if (!_db) return;
  for (const stmt of _stmts.values()) discard(stmt);
  _stmts.clear();
  _db.close();
  _db = null;
}
