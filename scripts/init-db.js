#!/usr/bin/env node
/**
 * scripts/init-db.js
 *
 * Applies database/schema.sql to the PostgreSQL database.
 * Run once on first deployment — safe to re-run (all statements are idempotent).
 *
 * Usage:
 *   node scripts/init-db.js
 *
 * Requires:
 *   DATABASE_URL environment variable (or .env file in project root)
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const { Client } = pg;

// ─── Load .env if present ────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath   = join(__dirname, "..", ".env");

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
} catch {
  // .env not found — rely on environment variables already set
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌  DATABASE_URL is not set.");
  console.error("    Set it in your .env file or as an environment variable.");
  process.exit(1);
}

const schemaPath = join(__dirname, "..", "database", "schema.sql");
let schema;
try {
  schema = readFileSync(schemaPath, "utf8");
} catch {
  console.error(`❌  Could not read ${schemaPath}`);
  process.exit(1);
}

const client = new Client({ connectionString });

try {
  console.log("🔌  Connecting to PostgreSQL...");
  await client.connect();
  console.log("✅  Connected.");

  console.log("📄  Applying database/schema.sql...");
  await client.query(schema);
  console.log("✅  Schema applied successfully.");

  // Quick sanity check
  const result = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);
  const tables = result.rows.map((r) => r.table_name);
  console.log(`\n📊  Tables in database (${tables.length}):`);
  tables.forEach((t) => console.log(`    • ${t}`));
  console.log("\n🎉  Database initialisation complete!");

} catch (err) {
  console.error("❌  Error applying schema:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
