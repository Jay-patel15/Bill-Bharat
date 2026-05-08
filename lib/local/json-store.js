/**
 * Local JSON-file backend that mirrors the Sheets adapter API.
 * Each "table" is a JSON file under .data/<table>.json (an array of records).
 * Used automatically when Google credentials are not configured, or when
 * DATA_BACKEND=json is set.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const DATA_DIR = process.env.JSON_DATA_DIR
  ? path.resolve(process.env.JSON_DATA_DIR)
  : path.join(process.cwd(), ".data");

// Per-table promise chain to serialize concurrent writes.
const locks = new Map();
function withLock(table, fn) {
  const prev = locks.get(table) || Promise.resolve();
  const next = prev.then(fn, fn);
  locks.set(table, next.catch(() => {}));
  return next;
}

async function readTable(table) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const file = path.join(DATA_DIR, `${table}.json`);
  try {
    const txt = await fs.readFile(file, "utf8");
    return JSON.parse(txt || "[]");
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
}

async function writeTable(table, rows) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const file = path.join(DATA_DIR, `${table}.json`);
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(rows, null, 2));
  await fs.rename(tmp, file);
}

export async function bootstrap() { /* no-op */ }

export async function listAll(table) {
  return readTable(table);
}

export async function findWhere(table, predicate) {
  return (await readTable(table)).filter(predicate);
}

export async function findOne(table, predicate) {
  return (await readTable(table)).find(predicate) || null;
}

export async function findById(table, id) {
  if (!id) return null;
  return findOne(table, (r) => r.id === id);
}

export async function insert(table, record) {
  return withLock(table, async () => {
    const rows = await readTable(table);
    const now = new Date().toISOString();
    const row = {
      ...record,
      id: record.id || randomUUID(),
      createdAt: record.createdAt || now,
      updatedAt: now
    };
    rows.push(row);
    await writeTable(table, rows);
    return row;
  });
}

export async function update(table, id, patch) {
  return withLock(table, async () => {
    const rows = await readTable(table);
    const idx = rows.findIndex((r) => r.id === id);
    if (idx < 0) throw new Error(`${table}:${id} not found`);
    rows[idx] = { ...rows[idx], ...patch, id, updatedAt: new Date().toISOString() };
    await writeTable(table, rows);
    return rows[idx];
  });
}

export async function remove(table, id) {
  return withLock(table, async () => {
    const rows = await readTable(table);
    const idx = rows.findIndex((r) => r.id === id);
    if (idx < 0) return false;
    rows.splice(idx, 1);
    await writeTable(table, rows);
    return true;
  });
}
