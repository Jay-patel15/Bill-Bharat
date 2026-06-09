/**
 * lib/db/postgres.js
 *
 * PostgreSQL connection pool, query helper, and transaction helper.
 * All database access in BillBharat flows through this module.
 *
 * Connection: DATABASE_URL environment variable
 * Example: postgresql://admin:PASSWORD@postgres:5432/billbharat_db
 */

import { Pool } from "pg";

// ---------------------------------------------------------------------------
// Pool singleton
// ---------------------------------------------------------------------------
let _pool = null;

function getPool() {
  if (_pool) return _pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. " +
      "Example: postgresql://admin:PASSWORD@postgres:5432/billbharat_db"
    );
  }

  _pool = new Pool({
    connectionString,
    max: 10,                  // max connections in pool
    idleTimeoutMillis: 30000, // close idle connections after 30s
    connectionTimeoutMillis: 5000, // fail if can't connect in 5s
    // Parse NUMERIC columns as float (pg returns strings by default)
    // Applied via type parser below
  });

  // Log unexpected pool errors (prevents unhandled rejections)
  _pool.on("error", (err) => {
    console.error("[pg pool] Unexpected client error:", err.message);
  });

  return _pool;
}

// ---------------------------------------------------------------------------
// Type parsers: make NUMERIC columns return JS numbers, not strings
// ---------------------------------------------------------------------------
import pg from "pg";
const { types } = pg;
// OID 1700 = NUMERIC/DECIMAL
types.setTypeParser(1700, (val) => (val === null ? null : parseFloat(val)));

// ---------------------------------------------------------------------------
// query() — run a single parameterised query, returns rows[]
// ---------------------------------------------------------------------------
export async function query(sql, params = []) {
  const pool = getPool();
  const result = await pool.query(sql, params);
  return result.rows;
}

// ---------------------------------------------------------------------------
// queryOne() — run a query and return the first row or null
// ---------------------------------------------------------------------------
export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// transaction() — run a set of queries inside a BEGIN/COMMIT block
//
// Usage:
//   const result = await transaction(async (client) => {
//     await client.query("INSERT ...", [...]);
//     const row = await client.query("SELECT ...", [...]);
//     return row.rows[0];
//   });
// ---------------------------------------------------------------------------
export async function transaction(fn) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// healthCheck() — verify the pool can reach the database
// ---------------------------------------------------------------------------
export async function healthCheck() {
  const rows = await query("SELECT 1 AS ok");
  return rows[0]?.ok === 1;
}
