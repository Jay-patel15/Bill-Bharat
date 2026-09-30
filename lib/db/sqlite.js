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

import sqlite3 from "node-sqlite3-wasm";
import { dbPath } from "../paths.js";
import { SCHEMA_SQL } from "./schema.js";

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

  // Durability + speed. WAL lets reads proceed during writes; NORMAL fsyncs
  // at checkpoints rather than every commit (safe against process crash,
  // which is the failure mode that matters for a desktop app).
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA synchronous = NORMAL");
  db.run("PRAGMA foreign_keys = ON");
  db.run("PRAGMA busy_timeout = 5000");
  db.run("PRAGMA cache_size = -64000"); // 64 MB page cache
  db.run("PRAGMA temp_store = MEMORY");

  // All statements are IF NOT EXISTS, so this is both first-run setup and
  // the upgrade path when a new table or index is added.
  db.exec(SCHEMA_SQL);

  _db = db;
  return _db;
}

/**
 * lib/db.js emits Postgres-style $1, $2, ... placeholders, always numbered in
 * the same order as the params array. SQLite wants positional `?`.
 */
function toSqlitePlaceholders(sql) {
  return sql.replace(/\$\d+/g, "?");
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

/** Escape hatch for the self-check and for closing cleanly on app quit. */
export function rawDb() {
  return getDb();
}

export function closeDb() {
  if (!_db) return;
  for (const stmt of _stmts.values()) discard(stmt);
  _stmts.clear();
  _db.close();
  _db = null;
}
