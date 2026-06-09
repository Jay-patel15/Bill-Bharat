#!/usr/bin/env node
/**
 * scripts/migrate-json-to-pg.js
 *
 * One-time migration utility: reads .data/*.json files (local JSON file backend)
 * and inserts all records into PostgreSQL.
 *
 * Run AFTER init-db.js has applied the schema.
 *
 * Usage:
 *   node scripts/migrate-json-to-pg.js
 *   node scripts/migrate-json-to-pg.js --dry-run   # Preview without writing
 *
 * Notes:
 *   - Records already present (same id) are SKIPPED (upsert-style).
 *   - Tables are processed in foreign-key dependency order.
 *   - Run only once; idempotent due to ON CONFLICT DO NOTHING.
 */

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const { Pool } = pg;
const __dirname  = dirname(fileURLToPath(import.meta.url));
const isDryRun   = process.argv.includes("--dry-run");

// ─── Load .env ───────────────────────────────────────────────────────────────
const envPath = join(__dirname, "..", ".env");
try {
  const envText = readFileSync(envPath, "utf8");
  for (const line of envText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = val;
  }
} catch {}

// ─── Table order (respects FK dependencies) ──────────────────────────────────
const TABLE_ORDER = [
  "users",
  "companies",
  "customers",
  "inventory",
  "projects",
  "sales",
  "purchases",
  "product_mappings",
  "payments",
  "ledger_entries",
  "journal_entries",
  "audit_logs"
];

// ─── JSONB columns that need stringification ─────────────────────────────────
const JSONB_COLS = {
  sales:           ["items"],
  purchases:       ["items"],
  projects:        ["boqItems"],
  journal_entries: ["entries"],
  audit_logs:      ["oldData", "newData"]
};

async function migrateTable(pool, table, dataDir) {
  const filePath = join(dataDir, `${table}.json`);
  let records;
  try {
    records = JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    console.log(`  ⏭  ${table}: no .data/${table}.json found, skipping.`);
    return { table, inserted: 0, skipped: 0 };
  }

  if (!Array.isArray(records) || records.length === 0) {
    console.log(`  ⏭  ${table}: 0 records.`);
    return { table, inserted: 0, skipped: 0 };
  }

  let inserted = 0;
  let skipped  = 0;

  for (const record of records) {
    // Stringify JSONB fields
    const jsonbCols = JSONB_COLS[table] || [];
    for (const col of jsonbCols) {
      if (record[col] !== undefined && typeof record[col] !== "string") {
        record[col] = JSON.stringify(record[col]);
      }
    }

    const keys   = Object.keys(record);
    const cols   = keys.map((k) => `"${k}"`).join(", ");
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
    const values = Object.values(record);

    if (isDryRun) {
      inserted++;
      continue;
    }

    try {
      await pool.query(
        `INSERT INTO "${table}" (${cols}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`,
        values
      );
      inserted++;
    } catch (err) {
      console.warn(`  ⚠  ${table} id=${record.id}: ${err.message}`);
      skipped++;
    }
  }

  return { table, inserted, skipped };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌  DATABASE_URL is not set.");
  process.exit(1);
}

const dataDir = join(__dirname, "..", ".data");
const pool    = new Pool({ connectionString, max: 3 });

console.log(isDryRun ? "🔍  DRY RUN — no data will be written.\n" : "🚀  Starting migration...\n");

try {
  const results = [];
  for (const table of TABLE_ORDER) {
    process.stdout.write(`  📦  ${table}... `);
    const r = await migrateTable(pool, table, dataDir);
    console.log(`inserted=${r.inserted}, skipped=${r.skipped}`);
    results.push(r);
  }

  const totalInserted = results.reduce((s, r) => s + r.inserted, 0);
  const totalSkipped  = results.reduce((s, r) => s + r.skipped, 0);
  console.log(`\n✅  Migration complete. Inserted: ${totalInserted}, Skipped: ${totalSkipped}`);
  if (isDryRun) console.log("    (Dry run — nothing was actually written)");
} catch (err) {
  console.error("❌  Migration failed:", err.message);
  process.exit(1);
} finally {
  await pool.end();
}
